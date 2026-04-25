import { inngest } from "./client";
import { getCandidatesForJob, getCandidate, getJob, getJobs } from "@/lib/integrations/workable";
import { generateJson } from "@/lib/integrations/gemini";
import { RESUME_VET_SYSTEM_PROMPT, buildVetPrompt } from "@/lib/prompts/resume-vet";
import { prisma } from "@/lib/utils/prisma";
import { postStarCandidateAlert } from "@/lib/integrations/slack";

export const vetAllCandidates = inngest.createFunction(
  {
    id: "vet-all-candidates",
    triggers: [{ event: "hiring/vet-all.requested" }],
    timeouts: { finish: "10m" },
  },
  async ({ event, step }: { event: { data: { shortcode: string; briefId: string | null } }; step: import("inngest").GetStepTools<typeof inngest> }) => {
    const { shortcode, briefId } = event.data as { shortcode: string; briefId: string | null };

    const allCandidates = await step.run("fetch-candidates", () =>
      getCandidatesForJob(shortcode)
    );
    const activeCandidates = allCandidates.filter((c) => !c.disqualified);

    const alreadyVetted = await step.run("check-existing-vet-cache", () =>
      prisma.candidateCache.findMany({
        where: {
          workableCandidateId: { in: activeCandidates.map((c) => c.id) },
          aiVetRunAt: { not: null },
        },
        select: { workableCandidateId: true },
      })
    );

    const vettedIds = new Set(alreadyVetted.map((c) => c.workableCandidateId));
    const toVet = activeCandidates.filter((c) => !vettedIds.has(c.id));

    if (toVet.length === 0) {
      return { vetted: 0, skipped: activeCandidates.length };
    }

    const [brief, job] = await step.run("fetch-job-context", () =>
      Promise.all([
        briefId
          ? prisma.hiringBrief.findFirst({
              where: { id: briefId },
              select: { id: true, roleTitle: true, hardSkills: true, softSkills: true, roleSummary: true },
            })
          : prisma.hiringBrief.findFirst({
              where: { workableJobId: shortcode },
              select: { id: true, roleTitle: true, hardSkills: true, softSkills: true, roleSummary: true },
            }),
        getJob(shortcode).catch(() => null),
      ])
    );

    const jobDescription = job?.description
      ? job.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 1000)
      : undefined;

    let vetted = 0;

    for (const candidate of toVet) {
      await step.run(`vet-candidate-${candidate.id}`, async () => {
        const fullCandidate = await getCandidate(candidate.id);
        const roleTitle = brief?.roleTitle ?? fullCandidate.job?.title ?? shortcode;
        const roleSummary = brief?.roleSummary ?? jobDescription;

        const prompt = buildVetPrompt(
          fullCandidate,
          roleTitle,
          brief?.hardSkills ?? null,
          brief?.softSkills ?? null,
          roleSummary
        );

        const result = await generateJson<{
          status: string;
          score: number;
          summary: string;
          scoreRationale?: string;
          aPlayerSignals: Record<string, string>;
          suggestedInterviewQuestions: string[];
        }>(RESUME_VET_SYSTEM_PROMPT, prompt);

        const cached = await prisma.candidateCache.upsert({
          where: { workableCandidateId: candidate.id },
          create: {
            workableCandidateId: candidate.id,
            workableJobId: shortcode,
            name: fullCandidate.name,
            email: fullCandidate.email,
            currentStage: fullCandidate.stage.name,
            appliedAt: new Date(fullCandidate.created_at),
            resumeUrl: fullCandidate.resume_url ?? null,
            linkedinUrl: fullCandidate.linkedin_url ?? null,
            country: fullCandidate.location?.country ?? null,
            city: fullCandidate.location?.city ?? null,
            aiVetScore: result.score,
            aiVetStatus: result.status,
            aiVetSummary: result.summary,
            aiVetRationale: result.scoreRationale ?? null,
            aiVetQuestions: result.suggestedInterviewQuestions ?? [],
            aiVetRunAt: new Date(),
            briefId: brief?.id ?? null,
          },
          update: {
            aiVetScore: result.score,
            aiVetStatus: result.status,
            aiVetSummary: result.summary,
            aiVetRationale: result.scoreRationale ?? null,
            aiVetQuestions: result.suggestedInterviewQuestions ?? [],
            aiVetRunAt: new Date(),
            currentStage: fullCandidate.stage.name,
            country: fullCandidate.location?.country ?? null,
            city: fullCandidate.location?.city ?? null,
          },
        });

        if ((cached.aiVetScore ?? 0) >= 80) {
          await postStarCandidateAlert({
            candidateName: fullCandidate.name,
            roleTitle,
            score: cached.aiVetScore!,
            shortcode,
          }).catch(() => undefined);
        }

        vetted++;
      });
    }

    return { vetted, skipped: vettedIds.size };
  }
);

// Batch size for parallel Workable detail fetches
const GEO_BATCH_SIZE = 10;

export const syncCandidateLocations = inngest.createFunction(
  {
    id: "sync-candidate-locations",
    triggers: [
      { cron: "0 2 * * *" },
      { event: "hiring/sync-locations.requested" },
    ],
    timeouts: { finish: "20m" },
  },
  async ({ step }: { step: import("inngest").GetStepTools<typeof inngest> }) => {
    const jobs = await step.run("fetch-active-jobs", () => getJobs());
    const activeJobs = jobs.filter((j) => j.state === "published");

    let totalSynced = 0;
    let totalSkipped = 0;

    for (const job of activeJobs) {
      const candidates = await step.run(`fetch-candidates-${job.shortcode}`, () =>
        getCandidatesForJob(job.shortcode)
      );
      const activeIds = candidates.filter((c) => !c.disqualified).map((c) => c.id);

      const cached = await step.run(`check-cache-${job.shortcode}`, () =>
        prisma.candidateCache.findMany({
          where: { workableCandidateId: { in: activeIds } },
          select: { workableCandidateId: true, country: true },
        })
      );

      const cachedWithCountry = new Set(
        cached.filter((c) => c.country).map((c) => c.workableCandidateId)
      );
      const needsSync = activeIds.filter((id) => !cachedWithCountry.has(id));
      totalSkipped += cachedWithCountry.size;

      for (let i = 0; i < needsSync.length; i += GEO_BATCH_SIZE) {
        const batch = needsSync.slice(i, i + GEO_BATCH_SIZE);
        const batchIndex = Math.floor(i / GEO_BATCH_SIZE);

        await step.run(`sync-geo-${job.shortcode}-batch-${batchIndex}`, async () => {
          const results = await Promise.allSettled(batch.map((id) => getCandidate(id)));

          for (const result of results) {
            if (result.status !== "fulfilled") continue;
            const c = result.value;
            const country = c.location?.country ?? null;
            const city = c.location?.city ?? null;

            const existing = cached.find((r) => r.workableCandidateId === c.id);
            if (existing) {
              await prisma.candidateCache.update({
                where: { workableCandidateId: c.id },
                data: { country, city },
              });
            } else {
              // Candidate exists in Workable but not yet in cache — create minimal row
              const source = candidates.find((r) => r.id === c.id);
              if (!source) return;
              await prisma.candidateCache.upsert({
                where: { workableCandidateId: c.id },
                create: {
                  workableCandidateId: c.id,
                  workableJobId: job.shortcode,
                  name: c.name,
                  email: c.email,
                  currentStage: source.stage?.name ?? "Applied",
                  appliedAt: new Date(c.created_at),
                  resumeUrl: c.resume_url ?? null,
                  linkedinUrl: c.linkedin_url ?? null,
                  country,
                  city,
                },
                update: { country, city },
              });
            }
            totalSynced++;
          }
        });
      }
    }

    return { synced: totalSynced, skipped: totalSkipped };
  }
);
