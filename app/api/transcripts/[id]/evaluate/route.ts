import { authOptions } from "@/lib/auth/config";
import { handleAuthError } from "@/lib/auth/roles";
import { generateStructured, CLAUDE_MODEL } from "@/lib/integrations/claude";
import { addCandidateComment, setCandidateStarRating } from "@/lib/integrations/workable";
import { buildCulturePrompt, CULTURE_PROMPT_VERSION } from "@/lib/prompts/culture-eval";
import { cultureFitOutputSchema } from "@/lib/schemas/evaluation";
import { computeRecommendedAction } from "@/lib/utils/bucket";
import { prisma } from "@/lib/utils/prisma";
import { EvaluationType, Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

function isAuthorized(req: NextRequest, session: Session | null): boolean {
  // Allow TALENT_ACQUISITION and ADMIN roles via session
  if (session?.user.role === "TALENT_ACQUISITION" || session?.user.role === "ADMIN") {
    return true;
  }
  // Allow internal service calls with the service key
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

    // We need the job title — fetch from latest brief via candidateCache if available
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

    // Compute totalScore from dimension scores as a safety check
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

    // Find latest JOB_POSTING_FIT evaluation for cross-signal disposition
    const jdEval = await prisma.evaluation.findFirst({
      where: { candidateId: candidate.id, type: EvaluationType.JOB_POSTING_FIT },
      orderBy: { createdAt: "desc" },
    });

    const recommendedAction = computeRecommendedAction(
      computedTotal,
      jdEval?.starRating ?? null
    );

    // Upsert disposition — only RECOMMENDED, never auto-approve
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

    // Update Workable — fire these in parallel, both non-fatal
    await Promise.allSettled([
      setCandidateStarRating(candidate.workableCandidateId, result.starRating),
      addCandidateComment(
        candidate.workableCandidateId,
        buildWorkableComment(candidate.name, result.starRating, computedTotal, result.summary)
      ),
    ]);

    // Mark transcript processed
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
  summary: string
): string {
  const stars = "★".repeat(starRating) + "☆".repeat(5 - starRating);
  return (
    `[AI Culture Eval — HR Only]\n` +
    `Candidate: ${candidateName}\n` +
    `Culture Fit: ${stars} (${totalScore}/40)\n\n` +
    summary
  );
}
