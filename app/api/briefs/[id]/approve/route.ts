import { authOptions } from "@/lib/auth/config";
import { updateApprovalStatus } from "@/lib/integrations/asana";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { ApprovalStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const approveSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "APPROVER", "HR", "ADMIN");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const brief = await prisma.hiringBrief.findUnique({ where: { id } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, note } = parsed.data;

  // Update Asana
  await updateApprovalStatus(
    brief.asanaTaskId,
    action === "APPROVED" ? "approved" : "rejected",
    session!.user.name ?? session!.user.email
  );

  // Update local DB
  const updated = await prisma.hiringBrief.update({
    where: { id },
    data: {
      approvalStatus: action as ApprovalStatus,
      approverName: session!.user.name ?? session!.user.email,
      approvedAt: new Date(),
      approvalNote: note,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: session!.user.email,
      eventType: action === "APPROVED" ? "BRIEF_APPROVED" : "BRIEF_REJECTED",
      entityId: id,
      entityType: "HiringBrief",
      metadata: { note },
    },
  });

  return NextResponse.json({ approvalStatus: updated.approvalStatus });
}
