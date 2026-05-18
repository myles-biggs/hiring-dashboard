/**
 * Backfill script — loads all published Workable jobs, paginates their
 * active candidates, upserts Candidate records, and triggers vetting.
 *
 * Safe to run multiple times — skips candidates already in the DB.
 *
 * Usage:
 *   npx tsx scripts/backfill-candidates.ts
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

for (const f of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), f);
  if (existsSync(p)) config({ path: p });
}

import { PrismaClient } from "@prisma/client";
import {
  listCandidatesForJob,
  listPublishedJobs,
  getCandidateDetail,
  updateCandidateCustomFields,
} from "../lib/integrations/workable";
import { generateStructured, CLAUDE_MODEL } from "../lib/integrations/claude";
import { buildVettingPrompt, VETTING_PROMPT_VERSION } from "../lib/prompts/candidate-vetting";
import { jobPostingFitOutputSchema } from "../lib/schemas/evaluation";
import { jobPostingBucket, recommendedAction } from "../lib/utils/bucket";

const prisma = new PrismaClient();

async function vetAndStore(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  const detail = await getCandidateDetail(candidate.workableCandidateId);

  const prompt = buildVettingPrompt({
    candidate: {
      ...candidate,
      coverLetter: candidate.coverLetter ?? detail.cover_letter ?? null,
      applicationAnswers:
        candidate.applicationAnswers ??
        (detail.answers ? (detail.answers as object) : null),
      linkedinUrl: candidate.linkedinUrl ?? detail.linkedin_url ?? null,
      tags: candidate.tags.length > 0 ? candidate.tags : (detail.tags ?? []),
      source: candidate.source ?? detail.source?.name ?? null,
    },
    jobTitle: candidate.workableJobTitle,
  });

  const result = await generateStructured(
    prompt.system,
    prompt.user,
    jobPostingFitOutputSchema,
  );

  const bucket = jobPostingBucket(result.score);
  const action = recommendedAction({ jdBucket: bucket, cultureBucket: null });

  await prisma.evaluation.create({
    data: {
      candidateId: candidate.id,
      type: "JOB_POSTING_FIT",
      modelUsed: CLAUDE_MODEL,
      promptVersion: VETTING_PROMPT_VERSION,
      rawOutput: JSON.stringify(result),
      score: result.score,
      bucket,
      rationale: result.rationale,
    },
  });

  await prisma.disposition.create({
    data: {
      candidateId: candidate.id,
      status: "RECOMMENDED",
      recommendedAction: action,
      rationale: result.rationale,
    },
  });

  try {
    await updateCandidateCustomFields(candidate.workableCandidateId, {
      jd_match_score: result.score,
      jd_match_bucket: bucket,
      jd_match_rationale: result.rationale,
      recommended_action: action,
      evaluated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("  Workable custom fields update failed:", e);
  }
}

async function main() {
  console.log("Starting candidate backfill...\n");

  const jobs = await listPublishedJobs();
  console.log(`Found ${jobs.length} published jobs.\n`);

  for (const job of jobs) {
    const candidates = await listCandidatesForJob(job.shortcode);
    const active = candidates.filter((c) => !c.disqualified);

    console.log(`Job ${job.shortcode} — ${job.title}: ${active.length} active candidates`);

    let skipped = 0;
    let vetted = 0;
    let errors = 0;

    for (const wc of active) {
      const existing = await prisma.candidate.findUnique({
        where: { workableCandidateId: wc.id },
        include: { evaluations: { take: 1 } },
      });

      if (existing?.evaluations.length) {
        skipped++;
        continue;
      }

      let dbCandidate = existing;
      if (!dbCandidate) {
        const stageName = typeof wc.stage === "string" ? wc.stage : wc.stage.name;
        dbCandidate = await prisma.candidate.upsert({
          where: { workableCandidateId: wc.id },
          update: {},
          create: {
            workableCandidateId: wc.id,
            workableJobShortcode: wc.job.shortcode,
            workableJobTitle: wc.job.title,
            name: wc.name,
            email: wc.email,
            currentStage: stageName,
            appliedAt: new Date(wc.created_at),
            resumeUrl: wc.resume_url ?? null,
            linkedinUrl: wc.linkedin_url ?? null,
            tags: wc.tags ?? [],
          },
        });
      }

      try {
        await vetAndStore(dbCandidate.id);
        vetted++;
        console.log(`  Vetted: ${wc.name}`);
      } catch (e) {
        errors++;
        console.error(`  Error vetting ${wc.name}:`, e);
      }
    }

    console.log(
      `  Done — skipped: ${skipped}, vetted: ${vetted}, errors: ${errors}\n`
    );
  }

  console.log("Backfill complete.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
