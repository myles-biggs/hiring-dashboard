import { authOptions } from "@/lib/auth/config";
import { createJob } from "@/lib/integrations/workable";
import { updateWorkableJobId } from "@/lib/integrations/asana";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const actorEmail = session!.user.email ?? session!.user.id;
  const { id } = await params;

  const brief = await prisma.hiringBrief.findUnique({ where: { id } });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (brief.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "Brief must be approved before posting" }, { status: 422 });
  }

  if (!brief.jdEnglish) {
    return NextResponse.json({ error: "Generate a JD before posting" }, { status: 422 });
  }

  if (brief.workableJobId) {
    return NextResponse.json({ error: "Job already posted to Workable" }, { status: 409 });
  }

  let workableJob: { shortcode: string; id: string };
  try {
    workableJob = await createJob({
      title: brief.roleTitle,
      department: brief.department,
      employmentType: brief.employmentType,
      descriptionEnglish: brief.jdEnglish,
      descriptionFrench: brief.jdFrench,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Workable job creation failed:", msg);
    return NextResponse.json({ error: `Failed to post job: ${msg}` }, { status: 502 });
  }

  await prisma.hiringBrief.update({
    where: { id },
    data: { workableJobId: workableJob.shortcode },
  });

  // Sync Workable job ID back to Asana — best-effort
  try {
    await updateWorkableJobId(brief.asanaTaskId, workableJob.shortcode);
  } catch (err) {
    console.error("Asana Workable ID sync failed:", err);
  }

  await prisma.auditEvent.create({
    data: {
      actorEmail,
      eventType: "JOB_POSTED",
      entityId: id,
      entityType: "HiringBrief",
      metadata: { workableJobId: workableJob.shortcode },
    },
  });

  return NextResponse.json({ workableJobId: workableJob.shortcode });
}
