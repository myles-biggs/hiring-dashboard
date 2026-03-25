import { authOptions } from "@/lib/auth/config";
import { getCandidatesForJob } from "@/lib/integrations/workable";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// GET — returns list of unvetted candidate IDs for this job
export async function GET(
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

  const allCandidates = await getCandidatesForJob(shortcode);
  const activeCandidates = allCandidates.filter((c) => !c.disqualified);

  if (activeCandidates.length === 0) {
    return NextResponse.json({ unvetted: [], total: 0 });
  }

  const alreadyVetted = await prisma.candidateCache.findMany({
    where: {
      workableCandidateId: { in: activeCandidates.map((c) => c.id) },
      aiVetRunAt: { not: null },
    },
    select: { workableCandidateId: true },
  });

  const vettedIds = new Set(alreadyVetted.map((c) => c.workableCandidateId));
  const unvetted = activeCandidates
    .filter((c) => !vettedIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }));

  return NextResponse.json({ unvetted, total: activeCandidates.length });
}
