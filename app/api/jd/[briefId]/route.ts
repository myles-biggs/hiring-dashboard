import { authOptions } from "@/lib/auth/config";
import { generateText } from "@/lib/integrations/gemini";
import { JD_SYSTEM_PROMPT, buildJDPrompt } from "@/lib/prompts/jd-generator";
import { requireRole } from "@/lib/auth/roles";
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
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { briefId } = await params;
  const brief = await prisma.hiringBrief.findUnique({ where: { id: briefId } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    // Claude may wrap JSON in markdown code fences
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
      actorEmail: session!.user.email,
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
