import { authOptions } from "@/lib/auth/config";
import { getCandidate, getJob } from "@/lib/integrations/workable";
import { generateJson } from "@/lib/integrations/gemini";
import { RESUME_VET_SYSTEM_PROMPT, buildVetPrompt } from "@/lib/prompts/resume-vet";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { postStarCandidateAlert } from "@/lib/integrations/slack";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ briefId: z.string().nullable().optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
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

  const { shortcode, candidateId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let candidate: Awaited<ReturnType<typeof getCandidate>>;
  try {
    candidate = await getCandidate(candidateId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch candidate: ${msg}` }, { status: 502 });
  }

  const brief = parsed.data.briefId
    ? await prisma.hiringBrief.findUnique({
        where: { id: parsed.data.briefId },
        select: { roleTitle: true, hardSkills: true, softSkills: true, roleSummary: true },
      })
    : null;

  let jobDescription: string | undefined;
  if (!brief) {
    try {
      const job = await getJob(shortcode);
      jobDescription = job.description
        ? job.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 1000)
        : undefined;
    } catch {
      // Non-fatal
    }
  }

  const roleTitle = brief?.roleTitle ?? candidate.job?.title ?? shortcode;
  const roleSummary = brief?.roleSummary ?? jobDescription;
  const prompt = buildVetPrompt(
    candidate,
    roleTitle,
    brief?.hardSkills ?? null,
    brief?.softSkills ?? null,
    roleSummary
  );

  let vetResult: {
    status: string;
    score: number;
    summary: string;
    scoreRationale?: string;
    aPlayerSignals: Record<string, string>;
    suggestedInterviewQuestions: string[];
  };

  try {
    const result = await generateJson<typeof vetResult>(RESUME_VET_SYSTEM_PROMPT, prompt);
    vetResult = {
      status: result.status,
      score: result.score,
      summary: result.summary,
      scoreRationale: result.scoreRationale,
      aPlayerSignals: result.aPlayerSignals ?? {},
      suggestedInterviewQuestions: result.suggestedInterviewQuestions ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AI vetting failed: ${message}` }, { status: 502 });
  }

  const stageName = typeof candidate.stage === "string"
    ? candidate.stage
    : (candidate.stage as { name?: string })?.name ?? "Applied";

  const cached = await prisma.candidateCache.upsert({
    where: { workableCandidateId: candidateId },
    create: {
      workableCandidateId: candidateId,
      workableJobId: shortcode,
      name: candidate.name,
      email: candidate.email,
      currentStage: stageName,
      appliedAt: new Date(candidate.created_at),
      resumeUrl: candidate.resume_url ?? null,
      linkedinUrl: candidate.linkedin_url ?? null,
      country: candidate.location?.country ?? null,
      city: candidate.location?.city ?? null,
      aiVetScore: vetResult.score,
      aiVetStatus: vetResult.status,
      aiVetSummary: vetResult.summary,
      aiVetRationale: vetResult.scoreRationale ?? null,
      aiVetQuestions: vetResult.suggestedInterviewQuestions,
      aiVetRunAt: new Date(),
      briefId: parsed.data.briefId ?? null,
    },
    update: {
      aiVetScore: vetResult.score,
      aiVetStatus: vetResult.status,
      aiVetSummary: vetResult.summary,
      aiVetRationale: vetResult.scoreRationale ?? null,
      aiVetQuestions: vetResult.suggestedInterviewQuestions,
      aiVetRunAt: new Date(),
      currentStage: stageName,
      country: candidate.location?.country ?? null,
      city: candidate.location?.city ?? null,
    },
  });

  if ((cached.aiVetScore ?? 0) >= 80) {
    postStarCandidateAlert({
      candidateName: candidate.name,
      roleTitle,
      score: cached.aiVetScore!,
      shortcode,
    }).catch(() => undefined);
  }

  return NextResponse.json({
    workableCandidateId: candidateId,
    aiVetScore: cached.aiVetScore,
    aiVetStatus: cached.aiVetStatus,
    aiVetSummary: cached.aiVetSummary,
    aiVetRationale: cached.aiVetRationale,
    aiVetQuestions: cached.aiVetQuestions,
  });
}
