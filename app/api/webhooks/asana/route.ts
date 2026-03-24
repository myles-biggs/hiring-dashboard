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

  // Verify webhook signature — required in all environments
  const webhookSecret = process.env.ASANA_WEBHOOK_SECRET;
  const signature = req.headers.get("x-hook-signature");
  const rawBody = await req.text();

  if (!webhookSecret) {
    console.error("ASANA_WEBHOOK_SECRET is not configured — rejecting webhook");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
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

  let payload: { events?: unknown[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = payload.events ?? [];

  for (const event of events) {
    const e = event as {
      resource?: { resource_type?: string; gid?: string };
      action?: string;
      change?: { field?: string; new_value?: { name?: string; text_value?: string } };
    };

    if (
      e.resource?.resource_type !== "task" ||
      e.action !== "changed" ||
      e.change?.field !== "custom_fields"
    ) {
      continue;
    }

    const taskGid = e.resource.gid;
    if (!taskGid) continue;

    const brief = await prisma.hiringBrief.findFirst({
      where: { asanaTaskId: taskGid },
    });

    if (!brief) continue;

    const newValue = e.change?.new_value;
    if (!newValue) continue;

    const statusName = newValue.name ?? newValue.text_value;
    if (!statusName) continue;

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
