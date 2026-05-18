import { authOptions } from "@/lib/auth/config";
import { handleAuthError, requireRole } from "@/lib/auth/roles";
import { CLAUDE_MODEL, generateStructured } from "@/lib/integrations/claude";
import { getCandidateDetail, updateCandidateCustomFields } from "@/lib/integrations/workable";
import { buildVettingPrompt, VETTING_PROMPT_VERSION } from "@/lib/prompts/candidate-vetting";
import { jobPostingFitOutputSchema } from "@/lib/schemas/evaluation";
import { jobPostingBucket, recommendedAction } from "@/lib/utils/bucket";
import { prisma } from "@/lib/utils/prisma";
import { EvaluationType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireRole(session, "TALENT_ACQUISITION", "ADMIN");
  } catch (err) {
    return handleAuthError(err);
  }

  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  try {
    const detail = await getCandidateDetail(candidate.workableCandidateId);

    const prompt = buildVettingPrompt({
      candidate: {
        ...candidate,
        coverLetter: candidate.coverLetter ?? detail.cover_letter ?? null,
        applicationAnswers:
          candidate.applicationAnswers ??
          (detail.answers ? (detail.answers as unknown as object) : null),
        linkedinUrl: candidate.linkedinUrl ?? detail.linkedin_url ?? null,
        tags: candidate.tags.length > 0 ? candidate.tags : (detail.tags ?? []),
        source: candidate.source ?? detail.source?.name ?? null,
      },
      jobTitle: candidate.workableJobTitle,
    });

    const result = await generateStructured(
      prompt.system,
      prompt.user,
      jobPostingFitOutputSchema
    );

    const evaluation = await prisma.evaluation.create({
      data: {
        candidateId: candidate.id,
        type: EvaluationType.JOB_POSTING_FIT,
        modelUsed: CLAUDE_MODEL,
        promptVersion: VETTING_PROMPT_VERSION,
        rawOutput: JSON.stringify(result),
        score: result.score,
        bucket: jobPostingBucket(result.score),
        rationale: result.rationale,
      },
    });

    const bucket = jobPostingBucket(result.score);
    const action = recommendedAction({ jdBucket: bucket, cultureBucket: null });

    const disposition = await prisma.disposition.create({
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
    } catch (workableErr) {
      console.error("Failed to update Workable custom fields:", workableErr);
    }

    return NextResponse.json({ data: { evaluationId: evaluation.id, dispositionId: disposition.id } });
  } catch (err) {
    console.error("Vetting failed for candidate", id, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vetting failed" },
      { status: 500 }
    );
  }
}
