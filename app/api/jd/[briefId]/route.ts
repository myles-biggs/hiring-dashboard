import { isBriefFlowEnabled } from "@/lib/utils/feature-flags";
export const maxDuration = 60;

import { authOptions } from "@/lib/auth/config";
import { generateJson } from "@/lib/integrations/gemini";
import { JOB_POST_SYSTEM_PROMPT, buildJobPostPrompt } from "@/lib/prompts/jd-generator";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(
  _req: NextRequest,
  {params }: { params: Promise<{ briefId: string }> }
) {
  if (!isBriefFlowEnabled()) {
    return NextResponse.json({ error: "Brief flow disabled" }, { status: 410 });
  }

  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "TALENT_ACQUISITION", "HIRING_MANAGER", "ADMIN");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorEmail = session!.user.email ?? session!.user.id;

  const { briefId } = await params;
  const brief = await prisma.hiringBrief.findUnique({ where: { id: briefId } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isTalentAcquisition = session!.user.role === "TALENT_ACQUISITION" || session!.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session!.user.email;
  if (!isTalentAcquisition && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (brief.approvalStatus !== "APPROVED") {
    return NextResponse.json(
      { error: "Brief must be approved before generating a job post" },
      { status: 422 }
    );
  }

  let parsed: { english: string; french: string | null };
  try {
    parsed = await generateJson<{ english: string; french: string | null }>(
      JOB_POST_SYSTEM_PROMPT,
      buildJobPostPrompt(brief)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate job post: ${message}` },
      { status: 502 }
    );
  }

  const updated = await prisma.hiringBrief.update({
    where: { id: briefId },
    data: {
      jdEnglish: parsed.english,
      jdFrench: parsed.french,
      jdGeneratedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail,
      eventType: "JOB_POST_GENERATED",
      entityId: briefId,
      entityType: "HiringBrief",
    },
  });

  return NextResponse.json({
    jdEnglish: updated.jdEnglish,
    jdFrench: updated.jdFrench,
    generatedAt: updated.jdGeneratedAt,
  });
}

const saveSchema = z.object({
  jdEnglish: z.string().min(1),
  jdFrench: z.string().optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "TALENT_ACQUISITION", "HIRING_MANAGER", "ADMIN");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { briefId } = await params;
  const brief = await prisma.hiringBrief.findUnique({ where: { id: briefId } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isTalentAcquisition = session!.user.role === "TALENT_ACQUISITION" || session!.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session!.user.email;
  if (!isTalentAcquisition && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.hiringBrief.update({
    where: { id: briefId },
    data: {
      jdEnglish: parsed.data.jdEnglish,
      jdFrench: parsed.data.jdFrench ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
