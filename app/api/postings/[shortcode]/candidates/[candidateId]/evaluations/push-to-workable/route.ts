import { authOptions } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const CV_LABEL: Record<string, string> = {
  "+": "(+) Consistently demonstrates",
  "+/-": "(+/-) Sometimes demonstrates",
  "-": "(-) Rarely demonstrates",
};

const PERF_LABEL: Record<string, string> = {
  UNDERPERFORMING: "Underperforming (Bottom 25%)",
  INCONSISTENT: "Inconsistent (Middle 50%)",
  STRONG: "Strong (Top 25%)",
  OUTSTANDING: "Outstanding (Top 10%)",
};

const FUTURE_LABEL: Record<string, string> = {
  RESISTANT: "Resistant",
  STATIC: "Static",
  FORWARD_LOOKING: "Forward-looking",
  TRAILBLAZER: "Trailblazer",
};

function formatEvaluation(ev: {
  pipelineStage: string;
  evaluatorName: string | null;
  evaluatorEmail: string;
  createdAt: Date;
  cvTruth: string;
  cvResults: string;
  cvBetterEveryDay: string;
  cvNoEgo: string;
  gwcGetsIt: boolean;
  gwcWantsIt: boolean;
  gwcCapacity: boolean;
  performance: string;
  futureReadiness: string;
  recommendation: string;
  notes: string | null;
  overrideReason: string | null;
}): string {
  const evaluator = ev.evaluatorName ?? ev.evaluatorEmail;
  const date = ev.createdAt.toLocaleDateString("en-CA");
  const rec =
    ev.recommendation === "ADVANCE" ? "Advance" : "Do Not Advance";
  const recIcon = ev.recommendation === "ADVANCE" ? "Advance" : "Do Not Advance";

  const lines = [
    `CANDIDATE EVALUATION - ${ev.pipelineStage}`,
    `Submitted by: ${evaluator} on ${date}`,
    "",
    "CORE VALUES",
    `- Driven by Truth: ${CV_LABEL[ev.cvTruth] ?? ev.cvTruth}`,
    `- Relentless For Results: ${CV_LABEL[ev.cvResults] ?? ev.cvResults}`,
    `- Better Every Day: ${CV_LABEL[ev.cvBetterEveryDay] ?? ev.cvBetterEveryDay}`,
    `- No Ego, All In: ${CV_LABEL[ev.cvNoEgo] ?? ev.cvNoEgo}`,
    "",
    "GWC",
    `- Gets It: ${ev.gwcGetsIt ? "Yes" : "No"}`,
    `- Wants It: ${ev.gwcWantsIt ? "Yes" : "No"}`,
    `- Capacity to Do It: ${ev.gwcCapacity ? "Yes" : "No"}`,
    "",
    `PERFORMANCE: ${PERF_LABEL[ev.performance] ?? ev.performance}`,
    `FUTURE READINESS: ${FUTURE_LABEL[ev.futureReadiness] ?? ev.futureReadiness}`,
    "",
    `RECOMMENDATION: ${recIcon === "Advance" ? "[ADVANCE]" : "[DO NOT ADVANCE]"} ${rec}`,
  ];

  if (ev.notes) {
    lines.push("", `Notes: ${ev.notes}`);
  }

  if (ev.overrideReason) {
    lines.push("", `Override reason: ${ev.overrideReason}`);
  }

  return lines.join("\n");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
) {
  if (!process.env.WORKABLE_API_TOKEN) {
    return NextResponse.json({ error: "Workable not configured" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requireRole(session, "TALENT_ACQUISITION", "ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shortcode, candidateId } = await params;

  const evaluations = await prisma.candidateEvaluation.findMany({
    where: { workableCandidateId: candidateId, workableJobId: shortcode },
    orderBy: { createdAt: "asc" },
  });

  if (evaluations.length === 0) {
    return NextResponse.json({ error: "No evaluations to push" }, { status: 400 });
  }

  const commentBody = evaluations.map(formatEvaluation).join("\n\n---\n\n");

  const baseUrl = `https://${process.env.WORKABLE_SUBDOMAIN}.workable.com/spi/v3`;
  const workableUrl = `${baseUrl}/jobs/${shortcode}/candidates/${candidateId}/activities`;
  const res = await fetch(workableUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WORKABLE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "note", body: commentBody }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Workable API error ${res.status}: ${text}` },
      { status: 502 }
    );
  }

  const now = new Date();
  await prisma.candidateEvaluation.updateMany({
    where: { id: { in: evaluations.map((e) => e.id) } },
    data: { workableCommentPosted: true, workableCommentPostedAt: now },
  });

  return NextResponse.json({ ok: true, count: evaluations.length });
}
