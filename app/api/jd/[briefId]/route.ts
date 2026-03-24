import { authOptions } from "@/lib/auth/config";
import { generateText } from "@/lib/integrations/gemini";
import { JD_SYSTEM_PROMPT, buildJDPrompt } from "@/lib/prompts/jd-generator";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "HR", "HIRING_MANAGER", "ADMIN");
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

  // Hiring managers may only generate JDs for briefs they own
  const isHR = session!.user.role === "HR" || session!.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session!.user.email;
  if (!isHR && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (brief.approvalStatus !== "APPROVED") {
    return NextResponse.json(
      { error: "Brief must be approved before generating a JD" },
      { status: 422 }
    );
  }

  const prompt = buildJDPrompt(brief);
  const raw = await generateText(JD_SYSTEM_PROMPT, prompt);

  let parsed: { english: string; french: string | null };
  try {
    // Gemini may wrap JSON in markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse JD from AI response", raw },
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
      eventType: "JD_GENERATED",
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
