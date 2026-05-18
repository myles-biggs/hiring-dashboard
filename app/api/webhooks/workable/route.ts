import { vetCandidate } from "@/lib/actions/vet-candidate";
import { verifyWebhookSignature, verifyWebhookToken } from "@/lib/integrations/workable";
import { workableCandidateWebhookSchema } from "@/lib/schemas/candidate";
import { prisma } from "@/lib/utils/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signatureHeader = req.headers.get("x-workable-signature");
  if (signatureHeader) {
    const valid = await verifyWebhookSignature(rawBody, signatureHeader);
    if (!valid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const token = req.nextUrl.searchParams.get("token");
    if (!verifyWebhookToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = workableCandidateWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.event_type !== "candidate_created") {
    return NextResponse.json({ received: true });
  }

  const wc = parsed.data.data.candidate;
  const job = parsed.data.data.job;
  if (!wc) return NextResponse.json({ received: true });

  const candidate = await prisma.candidate.upsert({
    where: { workableCandidateId: wc.id },
    update: {
      updatedAt: new Date(),
    },
    create: {
      workableCandidateId: wc.id,
      workableJobShortcode: job.shortcode,
      workableJobTitle: job.title,
      fullName: wc.name,
      email: wc.email ?? null,
      resumeUrl: wc.resume_url ?? null,
      linkedinUrl: wc.linkedin_profile_url ?? null,
      coverLetter: wc.cover_letter ?? null,
      applicationSource: wc.source?.name ?? null,
      applicationAnswers: wc.application_answers
        ? (wc.application_answers as object)
        : undefined,
    },
  });

  // Fire-and-forget — respond 200 immediately, vet in background
  vetCandidate(candidate.id).catch(console.error);

  return NextResponse.json({ received: true });
}
