import { authOptions } from "@/lib/auth/config";
import { getCandidate } from "@/lib/integrations/workable";
import { generateText } from "@/lib/integrations/gemini";
import { RESUME_VET_SYSTEM_PROMPT, buildVetPrompt } from "@/lib/prompts/resume-vet";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
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

  // Get full candidate data from Workable
  let candidate: Awaited<ReturnType<typeof getCandidate>>;
  try {
    candidate = await getCandidate(candidateId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch candidate: ${msg}` }, { status: 502 });
  }

  // Get brief data if available
  const brief = parsed.data.briefId
    ? await prisma.hiringBrief.findUnique({
        where: { id: parsed.data.briefId },
        select: { roleTitle: true, hardSkills: true, softSkills: true, roleSummary: true },
      })
    : null;

  const roleTitle = brief?.roleTitle ?? candidate.job?.title ?? shortcode;
  const prompt = buildVetPrompt(
    candidate,
    roleTitle,
    brief?.hardSkills ?? null,
    brief?.softSkills ?? null,
    brief?.roleSummary ?? undefined
  );

  const raw = await generateText(RESUME_VET_SYSTEM_PROMPT, prompt);

  let vetResult: {
    status: string;
    score: number;
    summary: string;
    aPlayerSignals: Record<string, string>;
    suggestedInterviewQuestions: string[];
  };

  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const result = JSON.parse(cleaned);
    vetResult = {
      status: result.status,
      score: result.score,
      summary: result.summary,
      aPlayerSignals: result.aPlayerSignals ?? result.aPLayerSignals ?? {},
      suggestedInterviewQuestions: result.suggestedInterviewQuestions ?? [],
    };
  } catch {
    return NextResponse.json({ error: "Failed to parse AI vet response", raw }, { status: 502 });
  }

  // Upsert into CandidateCache
  const cached = await prisma.candidateCache.upsert({
    where: { workableCandidateId: candidateId },
    create: {
      workableCandidateId: candidateId,
      workableJobId: shortcode,
      name: candidate.name,
      email: candidate.email,
      currentStage: candidate.stage.name,
      appliedAt: new Date(candidate.created_at),
      resumeUrl: candidate.resume_url,
      linkedinUrl: candidate.linkedin_url,
      aiVetScore: vetResult.score,
      aiVetStatus: vetResult.status,
      aiVetSummary: vetResult.summary,
      aiVetQuestions: vetResult.suggestedInterviewQuestions,
      aiVetRunAt: new Date(),
      briefId: parsed.data.briefId ?? null,
    },
    update: {
      aiVetScore: vetResult.score,
      aiVetStatus: vetResult.status,
      aiVetSummary: vetResult.summary,
      aiVetQuestions: vetResult.suggestedInterviewQuestions,
      aiVetRunAt: new Date(),
      currentStage: candidate.stage.name,
    },
  });

  return NextResponse.json({
    workableCandidateId: candidateId,
    aiVetScore: cached.aiVetScore,
    aiVetStatus: cached.aiVetStatus,
    aiVetSummary: cached.aiVetSummary,
    aiVetQuestions: cached.aiVetQuestions,
  });
}
