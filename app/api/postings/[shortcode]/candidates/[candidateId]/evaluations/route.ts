import { authOptions } from "@/lib/auth/config";
import { calculateThreshold } from "@/lib/evaluations/threshold";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CV_SCORES = ["+", "+/-", "-"] as const;
const PERF = ["UNDERPERFORMING", "INCONSISTENT", "STRONG", "OUTSTANDING"] as const;
const FUTURE = ["RESISTANT", "STATIC", "FORWARD_LOOKING", "TRAILBLAZER"] as const;

const schema = z.object({
  pipelineStage: z.string().min(1),
  cvTruth: z.enum(CV_SCORES),
  cvResults: z.enum(CV_SCORES),
  cvBetterEveryDay: z.enum(CV_SCORES),
  cvNoEgo: z.enum(CV_SCORES),
  gwcGetsIt: z.boolean(),
  gwcWantsIt: z.boolean(),
  gwcCapacity: z.boolean(),
  performance: z.enum(PERF),
  futureReadiness: z.enum(FUTURE),
  notes: z.string().optional().nullable(),
  recommendationOverride: z.enum(["ADVANCE", "DO_NOT_ADVANCE"]).optional(),
  overrideReason: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shortcode, candidateId } = await params;
  const stage = req.nextUrl.searchParams.get("stage");

  const evaluations = await prisma.candidateEvaluation.findMany({
    where: {
      workableCandidateId: candidateId,
      workableJobId: shortcode,
      ...(stage ? { pipelineStage: stage } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ evaluations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shortcode, candidateId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const meetsThreshold = calculateThreshold(d);
  const autoRecommendation = meetsThreshold ? "ADVANCE" : "DO_NOT_ADVANCE";
  const recommendation = d.recommendationOverride ?? autoRecommendation;
  const isOverride = !!d.recommendationOverride && d.recommendationOverride !== autoRecommendation;

  const evaluation = await prisma.candidateEvaluation.create({
    data: {
      workableCandidateId: candidateId,
      workableJobId: shortcode,
      pipelineStage: d.pipelineStage,
      evaluatorEmail: session.user.email ?? session.user.id,
      evaluatorName: session.user.name ?? null,
      cvTruth: d.cvTruth,
      cvResults: d.cvResults,
      cvBetterEveryDay: d.cvBetterEveryDay,
      cvNoEgo: d.cvNoEgo,
      gwcGetsIt: d.gwcGetsIt,
      gwcWantsIt: d.gwcWantsIt,
      gwcCapacity: d.gwcCapacity,
      performance: d.performance,
      futureReadiness: d.futureReadiness,
      notes: d.notes ?? null,
      meetsThreshold,
      recommendation,
      overrideReason: isOverride ? (d.overrideReason ?? null) : null,
      overrideByEmail: isOverride ? (session.user.email ?? session.user.id) : null,
      overrideAt: isOverride ? new Date() : null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: session.user.email ?? session.user.id,
      eventType: "CANDIDATE_EVALUATED",
      entityId: candidateId,
      entityType: "Candidate",
      metadata: { stage: d.pipelineStage, recommendation, meetsThreshold },
    },
  });

  return NextResponse.json({ evaluation });
}
