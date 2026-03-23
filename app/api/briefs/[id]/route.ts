import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const brief = await prisma.hiringBrief.findUnique({ where: { id } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isHR = session.user.role === "HR" || session.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session.user.email;
  const isApprover = session.user.role === "APPROVER";

  if (!isHR && !isOwner && !isApprover) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(brief);
}
