import { generateText } from "@/lib/integrations/anthropic";
import { addCandidateNote, verifyWebhookSignature } from "@/lib/integrations/workable";
import { buildVetPrompt, RESUME_VET_SYSTEM_PROMPT } from "@/lib/prompts/resume-vet";
import { prisma } from "@/lib/utils/prisma";
import { WorkableWebhookPayload } from "@/types/workable";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-workable-signature") ?? "";

  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: WorkableWebhookPayload = JSON.parse(rawBody);

  if (payload.event_type !== "candidate_created") {
    return NextResponse.json({ received: true });
  }

  const candidate = payload.data.candidate;
  if (!candidate) return NextResponse.json({ received: true });

  // Upsert candidate cache
  const cached = await prisma.candidateCache.upsert({
    where: { workableCandidateId: candidate.id },
    update: {
      currentStage: candidate.stage.name,
      updatedAt: new Date(),
    },
    create: {
      workableCandidateId: candidate.id,
      workableJobId: candidate.job.id,
      name: candidate.name,
      email: candidate.email,
      currentStage: candidate.stage.name,
      appliedAt: new Date(candidate.created_at),
      resumeUrl: candidate.resume_url,
      linkedinUrl: candidate.linkedin_url,
    },
  });

  // Find the matching brief for this job
  const brief = await prisma.hiringBrief.findFirst({
    where: { workableJobId: candidate.job.id },
  });

  if (!brief) {
    // No brief linked — still log the candidate, skip AI vet
    return NextResponse.json({ received: true });
  }

  // Run AI vetting
  const prompt = buildVetPrompt(
    candidate,
    brief.roleTitle,
    brief.hardSkills,
    brief.softSkills,
    brief.roleSummary ?? undefined
  );

  const raw = await generateText(RESUME_VET_SYSTEM_PROMPT, prompt);

  let vetResult: {
    status: string;
    score: number;
    summary: string;
    suggestedInterviewQuestions: string[];
  };

  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    vetResult = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse AI vet result for candidate", candidate.id, raw);
    return NextResponse.json({ received: true });
  }

  // Update candidate cache with vet result
  await prisma.candidateCache.update({
    where: { id: cached.id },
    data: {
      aiVetScore: vetResult.score,
      aiVetStatus: vetResult.status,
      aiVetSummary: vetResult.summary,
      aiVetQuestions: vetResult.suggestedInterviewQuestions,
      aiVetRunAt: new Date(),
      briefId: brief.id,
    },
  });

  // Write vet result back to Workable as a HR-only note
  const noteBody = `[AI Vet — HR Only]\nStatus: ${vetResult.status}\nScore: ${vetResult.score}/100\n\n${vetResult.summary}\n\nSuggested interview questions:\n${vetResult.suggestedInterviewQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

  await addCandidateNote(candidate.id, noteBody);

  await prisma.auditEvent.create({
    data: {
      actorEmail: "ai-vet-agent",
      eventType: "AI_VET_RUN",
      entityId: cached.id,
      entityType: "CandidateCache",
      metadata: { score: vetResult.score, status: vetResult.status },
    },
  });

  return NextResponse.json({ received: true });
}
