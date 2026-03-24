import { authOptions } from "@/lib/auth/config";
import { closeJob } from "@/lib/integrations/workable";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
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

  const { shortcode } = await params;

  try {
    await closeJob(shortcode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await prisma.auditEvent.create({
    data: {
      actorEmail: session!.user.email ?? session!.user.id,
      eventType: "JOB_CLOSED",
      entityId: shortcode,
      entityType: "WorkableJob",
      metadata: { jobShortcode: shortcode },
    },
  });

  return NextResponse.json({ ok: true });
}
