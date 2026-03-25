import { authOptions } from "@/lib/auth/config";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const BASE_URL = `https://${process.env.WORKABLE_SUBDOMAIN}.workable.com/spi/v3`;

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/workable?token=${process.env.WORKABLE_WEBHOOK_SECRET}`;

  const res = await fetch(`${BASE_URL}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WORKABLE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_url: webhookUrl,
      event: "candidate_created",
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: "Workable error", detail: body }, { status: res.status });
  }

  return NextResponse.json({ ok: true, subscription: body });
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await fetch(`${BASE_URL}/subscriptions`, {
    headers: {
      Authorization: `Bearer ${process.env.WORKABLE_API_TOKEN}`,
    },
  });

  const body = await res.json();
  return NextResponse.json(body);
}
