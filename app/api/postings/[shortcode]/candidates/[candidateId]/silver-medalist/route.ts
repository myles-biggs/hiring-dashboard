import { authOptions } from "@/lib/auth/config";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  isSilverMedalist: z.boolean(),
  note: z.string().optional(),
});

export async function PATCH(
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

  const { candidateId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.candidateCache.findUnique({
    where: { workableCandidateId: candidateId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Candidate not found in cache" }, { status: 404 });
  }

  const updated = await prisma.candidateCache.update({
    where: { workableCandidateId: candidateId },
    data: {
      isSilverMedalist: parsed.data.isSilverMedalist,
      silverMedalistNote: parsed.data.note ?? null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: session!.user.email ?? "unknown",
      eventType: parsed.data.isSilverMedalist ? "SILVER_MEDALIST_ADDED" : "SILVER_MEDALIST_REMOVED",
      entityId: candidateId,
      entityType: "CandidateCache",
      metadata: { note: parsed.data.note ?? null },
    },
  });

  return NextResponse.json({
    workableCandidateId: candidateId,
    isSilverMedalist: updated.isSilverMedalist,
    silverMedalistNote: updated.silverMedalistNote,
  });
}
