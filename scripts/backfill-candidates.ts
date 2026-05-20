/**
 * Backfill script — score all existing Workable candidates not yet in Level Hire DB.
 *
 * Run: npx tsx scripts/backfill-candidates.ts
 *
 * Idempotent: skips candidates already scored.
 */

import { EvaluationType } from "@prisma/client";
import { CLAUDE_MODEL, generateStructured } from "../lib/integrations/claude";
import {
  getCandidateDetail,
  listCandidatesForJob,
  listPublishedJobs,
  updateCandidateCustomFields,
} from "../lib/integrations/workable";
import { buildVettingPrompt, VETTING_PROMPT_VERSION } from "../lib/prompts/candidate-vetting";
import { jobPostingFitOutputSchema } from "../lib/schemas/evaluation";
import { jobPostingBucket, recommendedAction } from "../lib/utils/bucket";
import { prisma } from "../lib/utils/prisma";

const DELAY_MS = 1500;        // between Claude calls
const WORKABLE_DELAY_MS = 300; // between Workable API calls

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== Level Hire candidate backfill ===\n");

  const jobs = await listPublishedJobs();
  console.log(`Found ${jobs.length} published jobs\n`);

  let totalCandidates = 0;
  let skipped = 0;
  let scored = 0;
  let errors = 0;

  for (const job of jobs) {
    console.log(`-> ${job.title} (${job.shortcode})`);
    let active: Awaited<ReturnType<typeof listCandidatesForJob>> = [];
    try {
      const candidates = await listCandidatesForJob(job.shortcode);
      active = candidates.filter((c) => !c.disqualified);
    } catch (err) {
      console.warn(`   ! Skipping job (API error): ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    console.log(`   ${active.length} active candidates`);

    for (const wc of active) {
      totalCandidates++;

      const existing = await prisma.candidate.findUnique({
        where: { workableCandidateId: wc.id },
        include: {
          evaluations: { where: { type: EvaluationType.JOB_POSTING_FIT }, take: 1 },
        },
      });

      if (existing?.evaluations.length) {
        skipped++;
        continue;
      }

      try {
        await sleep(WORKABLE_DELAY_MS);
        const detail = await getCandidateDetail(wc.id);

        const candidate = await prisma.candidate.upsert({
          where: { workableCandidateId: wc.id },
          create: {
            workableCandidateId: wc.id,
            workableJobShortcode: job.shortcode,
            workableJobTitle: job.title,
            fullName: wc.name,
            email: wc.email ?? null,
            resumeUrl: wc.resume_url ?? null,
            linkedinUrl: detail.linkedin_url ?? null,
            coverLetter: detail.cover_letter ?? null,
            applicationAnswers: detail.answers ? (detail.answers as object) : undefined,
            applicationSource: detail.source?.name ?? null,
          },
          update: {
            resumeUrl: wc.resume_url ?? undefined,
            linkedinUrl: detail.linkedin_url ?? undefined,
            coverLetter: detail.cover_letter ?? undefined,
          },
        });

        const prompt = buildVettingPrompt({
          candidate: {
            ...candidate,
            coverLetter: candidate.coverLetter ?? detail.cover_letter ?? null,
            applicationAnswers:
              candidate.applicationAnswers ??
              (detail.answers ? (detail.answers as object) : null),
            linkedinUrl: candidate.linkedinUrl ?? detail.linkedin_url ?? null,
            applicationSource: candidate.applicationSource ?? detail.source?.name ?? null,
          },
          jobTitle: job.title,
        });

        const result = await generateStructured(
          prompt.system,
          prompt.user,
          jobPostingFitOutputSchema
        );

        const bucket = jobPostingBucket(result.score);
        const { action, reason } = recommendedAction({ jdBucket: bucket, cultureBucket: null });

        await prisma.evaluation.create({
          data: {
            candidateId: candidate.id,
            type: EvaluationType.JOB_POSTING_FIT,
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
            recommendedReason: reason,
          },
        });

        try {
          await updateCandidateCustomFields(wc.id, {
            jd_match_score: result.score,
            jd_match_bucket: bucket,
            jd_match_rationale: result.rationale,
            recommended_action: action,
            evaluated_at: new Date().toISOString(),
          });
        } catch (workableErr) {
          console.warn(
            `   ! Workable custom field write failed: ${workableErr instanceof Error ? workableErr.message : String(workableErr)}`
          );
        }

        scored++;
        console.log(`   + ${wc.name} — ${result.score} (${bucket}) -> ${action}`);
        await sleep(DELAY_MS);
      } catch (err) {
        errors++;
        console.error(
          `   x ${wc.name} — ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Total active candidates: ${totalCandidates}`);
  console.log(`Already scored (skipped): ${skipped}`);
  console.log(`Newly scored: ${scored}`);
  console.log(`Errors: ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
