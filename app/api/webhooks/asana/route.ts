import { prisma } from "@/lib/utils/prisma";
import { ApprovalStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const APPROVAL_STATUS_MAP: Record<string, ApprovalStatus> = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
  Escalated: "ESCALATED",
};

export async function POST(req: NextRequest) {
  // Asana sends a handshake on webhook registration — respond with the secret
  const handshakeSecret = req.headers.get("x-hook-secret");
  if (handshakeSecret) {
    return new NextResponse(null, {
      status: 200,
      headers: { "x-hook-secret": handshakeSecret },
    });
  }

  // Verify webhook signature
  const signature = req.headers.get("x-hook-signature");
  const rawBody = await req.text();

  if (process.env.ASANA_WEBHOOK_SECRET && signature) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(process.env.ASANA_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computed = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computed !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);
  const events = payload.events ?? [];

  for (const event of events) {
    if (
      event.resource?.resource_type !== "task" ||
      event.action !== "changed" ||
      event.change?.field !== "custom_fields"
    ) {
      continue;
    }

    const taskGid = event.resource.gid;
    const brief = await prisma.hiringBrief.findFirst({
      where: { asanaTaskId: taskGid },
    });

    if (!brief) continue;

    // The change contains new_value — we look for the approval status field GID
    const newValue = event.change?.new_value;
    if (!newValue) continue;

    // Asana custom field changes come back as enum option names
    const statusName = newValue?.name ?? newValue?.text_value;
    const mapped = APPROVAL_STATUS_MAP[statusName];

    if (mapped && mapped !== brief.approvalStatus) {
      await prisma.hiringBrief.update({
        where: { id: brief.id },
        data: {
          approvalStatus: mapped,
          approvedAt: mapped === "APPROVED" ? new Date() : brief.approvedAt,
        },
      });

      await prisma.auditEvent.create({
        data: {
          actorEmail: "asana-webhook",
          eventType: `BRIEF_${mapped}_VIA_ASANA`,
          entityId: brief.id,
          entityType: "HiringBrief",
          metadata: { taskGid, newStatus: mapped },
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
