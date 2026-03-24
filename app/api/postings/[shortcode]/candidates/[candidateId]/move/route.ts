import { authOptions } from "@/lib/auth/config";
import { moveCandidate } from "@/lib/integrations/workable";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ stageSlug: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
) {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "HR", "ADMIN");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shortcode, candidateId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await moveCandidate(shortcode, candidateId, parsed.data.stageSlug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await prisma.auditEvent.create({
    data: {
      actorEmail: session!.user.email ?? session!.user.id,
      eventType: "CANDIDATE_MOVED",
      entityId: candidateId,
      entityType: "Candidate",
      metadata: { jobShortcode: shortcode, targetStage: parsed.data.stageSlug },
    },
  });

  return NextResponse.json({ ok: true });
}
