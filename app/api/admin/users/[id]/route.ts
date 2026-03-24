import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  role: z.enum(["HIRING_MANAGER", "TALENT_ACQUISITION", "ADMIN"]).optional(),
  isApprover: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: session.user.email ?? session.user.id,
      eventType: "USER_UPDATED",
      entityId: id,
      entityType: "User",
      metadata: parsed.data,
    },
  });

  return NextResponse.json({ ok: true, role: updated.role, isApprover: updated.isApprover });
}
