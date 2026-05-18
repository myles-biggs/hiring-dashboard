import { getMeetingParticipants, getTranscript } from "@/lib/integrations/zoom";
import { zoomTranscriptWebhookSchema } from "@/lib/schemas/transcript";
import { prisma } from "@/lib/utils/prisma";
import { Prisma } from "@prisma/client";
import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function verifyZoomSignature(
  rawBody: string,
  timestamp: string,
  signature: string
): boolean {
  const secret = process.env.ZOOM_WEBHOOK_SECRET;
  if (!secret) return false;

  const message = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(message).digest("hex")}`;
  return expected === signature;
}

async function runCultureEval(transcriptId: string): Promise<void> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/transcripts/${transcriptId}/evaluate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Internal call — use a service token rather than user session
      // The route handler validates via its own auth check
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Culture eval trigger failed ${res.status}: ${body}`);
  }
}

export async function POST(req: NextRequest) {
  const timestamp = req.headers.get("x-zm-request-timestamp") ?? "";
  const signature = req.headers.get("x-zm-signature") ?? "";

  const rawBody = await req.text();

  if (!verifyZoomSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = zoomTranscriptWebhookSchema.safeParse(parsed);
  if (!result.success) {
    // Not the event type we handle — return 200 so Zoom doesn't retry
    return NextResponse.json({ received: true });
  }

  const { object } = result.data.payload;
  const meetingId = object.id;
  const meetingDate = new Date(object.start_time);
  const hostEmail = object.host_email;
  const meetingTopic = object.topic;

  // Find the transcript recording file (TRANSCRIPT type, .vtt)
  const transcriptFile = object.recording_files.find(
    (f: { file_type: string; id?: string; download_url: string; status: string }) =>
      f.file_type.toUpperCase() === "TRANSCRIPT"
  );

  if (!transcriptFile) {
    console.warn(`[zoom-webhook] No transcript file in meeting ${meetingId}`);
    return NextResponse.json({ received: true });
  }

  // Download transcript and fetch participants in parallel
  const [rawText, participantEmails] = await Promise.all([
    getTranscript(transcriptFile.id ?? transcriptFile.download_url),
    getMeetingParticipants(meetingId).catch((err: unknown) => {
      console.error(`[zoom-webhook] Failed to fetch participants for ${meetingId}`, err);
      return [] as string[];
    }),
  ]);

  // Candidate matching — step 1: participant email
  let candidate = await (async () => {
    for (const email of participantEmails) {
      const match = await prisma.candidate.findFirst({ where: { email } });
      if (match) return match;
    }
    return null;
  })();

  let matchMethod: "PARTICIPANT_EMAIL" | "MEETING_TOPIC" | null =
    candidate ? "PARTICIPANT_EMAIL" : null;

  // Step 2: extract email from meeting topic
  if (!candidate) {
    const emailMatch = meetingTopic.match(
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
    );
    if (emailMatch) {
      candidate = await prisma.candidate.findFirst({
        where: { email: emailMatch[0] },
      });
      if (candidate) matchMethod = "MEETING_TOPIC";
    }
  }

  // Step 3: no match — log and persist for manual review
  if (!candidate || !matchMethod) {
    console.warn(
      `[zoom-webhook] No candidate match for meeting ${meetingId}. ` +
        `Topic: "${meetingTopic}". Participants: ${participantEmails.join(", ")}`
    );
    await prisma.unmatchedTranscript.create({
      data: {
        zoomMeetingId: meetingId,
        meetingDate,
        rawPayload: parsed as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ received: true });
  }

  const transcript = await prisma.interviewTranscript.create({
    data: {
      candidateId: candidate.id,
      zoomMeetingId: meetingId,
      zoomRecordingId: transcriptFile.id,
      meetingDate,
      interviewerEmails: hostEmail ? [hostEmail] : [],
      matchMethod,
      transcriptText: rawText,
    },
  });

  // Fire-and-forget culture evaluation
  runCultureEval(transcript.id).catch(console.error);

  return NextResponse.json({ received: true });
}
