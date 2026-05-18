import { isBriefFlowEnabled } from "@/lib/utils/feature-flags";
import { authOptions } from "@/lib/auth/config";
import { updateApprovalStatus } from "@/lib/integrations/asana";
import { requireApprover, AuthError } from "@/lib/auth/roles";
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
  {params }: { params: Promise<{ id: string }> }
) {
  if (!isBriefFlowEnabled()) {
    return NextResponse.json({ error: "Brief flow disabled" }, { status: 410 });
  }

  const session = await getServerSession(authOptions);

  try {
    requireApprover(session);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorEmail = session!.user.email ?? session!.user.id;

  const { id } = await params;
  const body = await req.json();
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const brief = await prisma.hiringBrief.findUnique({ where: { id } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, note } = parsed.data;

  // Update DB first (source of truth), then sync Asana best-effort
  const updated = await prisma.hiringBrief.update({
    where: { id },
    data: {
      approvalStatus: action as ApprovalStatus,
      approverName: session!.user.name ?? actorEmail,
      approverEmail: actorEmail,
      approvedAt: new Date(),
      approvalNote: note,
    },
  });

  // Sync Asana — log failure but don't block the response
  try {
    await updateApprovalStatus(
      brief.asanaTaskId,
      action === "APPROVED" ? "approved" : "rejected",
      session!.user.name ?? actorEmail
    );
  } catch (err) {
    console.error("Asana sync failed after approval — DB updated, Asana out of sync:", err);
  }

  await prisma.auditEvent.create({
    data: {
      actorEmail,
      eventType: action === "APPROVED" ? "BRIEF_APPROVED" : "BRIEF_REJECTED",
      entityId: id,
      entityType: "HiringBrief",
      metadata: { note },
    },
  });

  return NextResponse.json({ approvalStatus: updated.approvalStatus });
}
