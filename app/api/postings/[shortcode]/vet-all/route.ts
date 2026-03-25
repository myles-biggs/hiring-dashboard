export const maxDuration = 60;

import { authOptions } from "@/lib/auth/config";
import { getCandidatesForJob, getCandidate, getJob } from "@/lib/integrations/workable";
import { generateJson } from "@/lib/integrations/gemini";
import { RESUME_VET_SYSTEM_PROMPT, buildVetPrompt } from "@/lib/prompts/resume-vet";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "TALENT_ACQUISITION", "ADMIN");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shortcode } = await params;

  // Fetch all active candidates for this job
  const allCandidates = await getCandidatesForJob(shortcode);
  const activeCandidates = allCandidates.filter((c) => !c.disqualified);

  if (activeCandidates.length === 0) {
    return NextResponse.json({ vetted: 0, skipped: 0, results: [] });
  }

  // Find which candidates already have vet data
  const alreadyVetted = await prisma.candidateCache.findMany({
    where: {
      workableCandidateId: { in: activeCandidates.map((c) => c.id) },
      aiVetRunAt: { not: null },
    },
    select: { workableCandidateId: true },
  });
  const vettedIds = new Set(alreadyVetted.map((c) => c.workableCandidateId));

  const toVet = activeCandidates.filter((c) => !vettedIds.has(c.id));
  const skipped = activeCandidates.length - toVet.length;

  if (toVet.length === 0) {
    return NextResponse.json({ vetted: 0, skipped, results: [] });
  }

  // Find linked brief + job description (shared across all candidates for this job)
  const [brief, job] = await Promise.all([
    prisma.hiringBrief.findFirst({
      where: { workableJobId: shortcode },
      select: { id: true, roleTitle: true, hardSkills: true, softSkills: true, roleSummary: true },
    }),
    getJob(shortcode).catch(() => null),
  ]);

  const jobDescription = job?.description
    ? job.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 1000)
    : undefined;

  const results: { candidateId: string; name: string; score: number }[] = [];

  // Process sequentially to avoid Gemini rate limits
  for (const candidate of toVet) {
    try {
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
        aPlayerSignals: Record<string, string>;
        suggestedInterviewQuestions: string[];
      }>(RESUME_VET_SYSTEM_PROMPT, prompt);

      await prisma.candidateCache.upsert({
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
          aiVetScore: result.score,
          aiVetStatus: result.status,
          aiVetSummary: result.summary,
          aiVetQuestions: result.suggestedInterviewQuestions ?? [],
          aiVetRunAt: new Date(),
          briefId: brief?.id ?? null,
        },
        update: {
          aiVetScore: result.score,
          aiVetStatus: result.status,
          aiVetSummary: result.summary,
          aiVetQuestions: result.suggestedInterviewQuestions ?? [],
          aiVetRunAt: new Date(),
          currentStage: fullCandidate.stage.name,
        },
      });

      results.push({ candidateId: candidate.id, name: fullCandidate.name, score: result.score });
    } catch {
      // Skip failed candidates — don't abort the whole batch
    }
  }

  return NextResponse.json({ vetted: results.length, skipped, results });
}
