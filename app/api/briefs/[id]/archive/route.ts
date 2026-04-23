import { authOptions } from "@/lib/auth/config";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;

  const brief = await prisma.hiringBrief.findUnique({ where: { id } });
  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  await prisma.hiringBrief.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: session!.user.email ?? "unknown",
      eventType: "BRIEF_ARCHIVED",
      entityId: id,
      entityType: "HiringBrief",
    },
  });

  return NextResponse.json({ success: true });
}
