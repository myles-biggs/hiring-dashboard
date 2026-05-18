import { authOptions } from "@/lib/auth/config";
import { handleAuthError } from "@/lib/auth/roles";
import { generateStructured, CLAUDE_MODEL } from "@/lib/integrations/claude";
import { addCandidateComment, setCandidateStarRating } from "@/lib/integrations/workable";
import { buildCulturePrompt, CULTURE_PROMPT_VERSION } from "@/lib/prompts/culture-eval";
import { cultureFitOutputSchema } from "@/lib/schemas/evaluation";
import { cultureBucket, jobPostingBucket, recommendedAction } from "@/lib/utils/bucket";
import { prisma } from "@/lib/utils/prisma";
import { EvaluationType, Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

function isAuthorized(req: NextRequest, session: Session | null): boolean {
  if (session?.user.role === "TALENT_ACQUISITION" || session?.user.role === "ADMIN") {
    return true;
  }
  const serviceKey = process.env.INTERNAL_SERVICE_KEY;
  if (serviceKey) {
    const authHeader = req.headers.get("x-service-key");
    if (authHeader === serviceKey) return true;
  }
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAuthorized(req, session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const transcript = await prisma.interviewTranscript.findUnique({
      where: { id },
      include: { candidate: true },
    });

    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    if (transcript.processed) {
      return NextResponse.json({ error: "Transcript already evaluated" }, { status: 409 });
    }

    const candidate = transcript.candidate;

    const candidateCache = await prisma.candidateCache.findFirst({
      where: { workableCandidateId: candidate.workableCandidateId },
      include: { brief: true },
    });
    const jobTitle = candidateCache?.brief?.roleTitle ?? candidate.workableJobTitle;

    const { system, user } = buildCulturePrompt({
      transcript: transcript.transcriptText,
      candidateName: candidate.fullName,
      jobTitle,
    });

    const result = await generateStructured(system, user, cultureFitOutputSchema);

    const cb = cultureBucket(result.totalScore);

    const evaluation = await prisma.evaluation.create({
      data: {
        candidateId: candidate.id,
        type: EvaluationType.CULTURE_FIT,
        sources: ["TRANSCRIPT"],
        modelUsed: CLAUDE_MODEL,
        promptVersion: CULTURE_PROMPT_VERSION,
        rawOutput: JSON.stringify(result),
        dimensionScores: result.dimensionScores as unknown as Prisma.InputJsonValue,
        score: result.totalScore,
        bucket: cb,
        rationale: result.rationale,
      },
    });

    const jdEval = await prisma.evaluation.findFirst({
      where: { candidateId: candidate.id, type: EvaluationType.JOB_POSTING_FIT },
      orderBy: { createdAt: "desc" },
    });

    const jdBucket = jdEval ? jobPostingBucket(jdEval.score) : "POSSIBLE";
    const { action: recAction, reason: recReason } = recommendedAction({ jdBucket, cultureBucket: cb });

    const existingDisposition = await prisma.disposition.findFirst({
      where: { candidateId: candidate.id, status: "RECOMMENDED" },
    });

    if (existingDisposition) {
      await prisma.disposition.update({
        where: { id: existingDisposition.id },
        data: { recommendedAction: recAction, recommendedReason: recReason },
      });
    } else {
      await prisma.disposition.create({
        data: {
          candidateId: candidate.id,
          status: "RECOMMENDED",
          recommendedAction: recAction,
          recommendedReason: recReason,
        },
      });
    }

    const starRating = result.starRating as 1 | 2 | 3 | 4 | 5;
    await Promise.allSettled([
      setCandidateStarRating(candidate.workableCandidateId, starRating),
      addCandidateComment(
        candidate.workableCandidateId,
        buildWorkableComment(candidate.fullName, result.starRating, result.totalScore, result.rationale)
      ),
    ]);

    await prisma.interviewTranscript.update({
      where: { id: transcript.id },
      data: { processed: true, processedAt: new Date() },
    });

    return NextResponse.json({ data: { evaluationId: evaluation.id } });
  } catch (err) {
    return handleAuthError(err);
  }
}

function buildWorkableComment(
  candidateName: string,
  starRating: number,
  totalScore: number,
  rationale: string
): string {
  const stars = "★".repeat(starRating) + "☆".repeat(5 - starRating);
  return (
    `[AI Culture Eval — HR Only]\n` +
    `Candidate: ${candidateName}\n` +
    `Culture Fit: ${stars} (${totalScore}/40)\n\n` +
    rationale
  );
}
