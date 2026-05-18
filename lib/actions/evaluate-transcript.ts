"use server";

import { authOptions } from "@/lib/auth/config";
import { AuthError } from "@/lib/auth/roles";
import { generateStructured, CLAUDE_MODEL } from "@/lib/integrations/claude";
import { addCandidateComment, setCandidateStarRating } from "@/lib/integrations/workable";
import { buildCulturePrompt, CULTURE_PROMPT_VERSION } from "@/lib/prompts/culture-eval";
import { cultureFitOutputSchema } from "@/lib/schemas/evaluation";
import { computeRecommendedAction } from "@/lib/utils/bucket";
import { prisma } from "@/lib/utils/prisma";
import { EvaluationType, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

export async function evaluateTranscript(
  transcriptId: string
): Promise<{ evaluationId: string }> {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== "TALENT_ACQUISITION" && session.user.role !== "ADMIN")
  ) {
    throw new AuthError(401, "Unauthorized");
  }

  const transcript = await prisma.interviewTranscript.findUnique({
    where: { id: transcriptId },
    include: { candidate: true },
  });

  if (!transcript) throw new AuthError(404, "Transcript not found");
  if (transcript.processed) throw new AuthError(409, "Transcript already evaluated");

  const candidate = transcript.candidate;

  const candidateCache = await prisma.candidateCache.findFirst({
    where: { workableCandidateId: candidate.workableCandidateId },
    include: { brief: true },
  });
  const jobTitle = candidateCache?.brief?.roleTitle ?? "Unknown Role";

  const { system, user } = buildCulturePrompt({
    transcript: transcript.rawText,
    candidateName: candidate.name,
    jobTitle,
  });

  const result = await generateStructured(system, user, cultureFitOutputSchema);

  const dimValues = Object.values(result.dimensionScores).map((d) => d.score);
  const computedTotal = dimValues.reduce((sum, s) => sum + s, 0);

  const evaluation = await prisma.evaluation.create({
    data: {
      candidateId: candidate.id,
      type: EvaluationType.CULTURE_FIT,
      sources: ["TRANSCRIPT"],
      modelUsed: CLAUDE_MODEL,
      promptVersion: CULTURE_PROMPT_VERSION,
      rawOutput: JSON.stringify(result),
      dimensionScores: result.dimensionScores as unknown as Prisma.InputJsonValue,
      totalScore: computedTotal,
      starRating: result.starRating,
    },
  });

  const jdEval = await prisma.evaluation.findFirst({
    where: { candidateId: candidate.id, type: EvaluationType.JOB_POSTING_FIT },
    orderBy: { createdAt: "desc" },
  });

  const recommendedAction = computeRecommendedAction(
    computedTotal,
    jdEval?.starRating ?? null
  );

  const existingDisposition = await prisma.disposition.findFirst({
    where: { candidateId: candidate.id, status: "RECOMMENDED" },
  });

  if (existingDisposition) {
    await prisma.disposition.update({
      where: { id: existingDisposition.id },
      data: { recommendedAction },
    });
  } else {
    await prisma.disposition.create({
      data: {
        candidateId: candidate.id,
        status: "RECOMMENDED",
        recommendedAction,
      },
    });
  }

  await Promise.allSettled([
    setCandidateStarRating(candidate.workableCandidateId, result.starRating),
    addCandidateComment(
      candidate.workableCandidateId,
      `[AI Culture Eval — HR Only]\nCandidate: ${candidate.name}\n` +
        `Culture Fit: ${"★".repeat(result.starRating)}${"☆".repeat(5 - result.starRating)} (${computedTotal}/40)\n\n` +
        result.summary
    ),
  ]);

  await prisma.interviewTranscript.update({
    where: { id: transcript.id },
    data: { processed: true, processedAt: new Date() },
  });

  return { evaluationId: evaluation.id };
}
