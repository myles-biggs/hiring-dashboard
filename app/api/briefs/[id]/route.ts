import { isBriefFlowEnabled } from "@/lib/utils/feature-flags";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  {params }: { params: Promise<{ id: string }> }
) {
  if (!isBriefFlowEnabled()) {
    return NextResponse.json({ error: "Brief flow disabled" }, { status: 410 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const brief = await prisma.hiringBrief.findUnique({ where: { id } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isTalentAcquisition = session.user.role === "TALENT_ACQUISITION" || session.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session.user.email;
  const isApprover = session.user.isApprover ?? false;

  if (!isTalentAcquisition && !isOwner && !isApprover) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(brief);
}
