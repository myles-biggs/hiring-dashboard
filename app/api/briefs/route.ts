import { authOptions } from "@/lib/auth/config";
import { createBriefTask } from "@/lib/integrations/asana";
import { briefSchema } from "@/lib/schemas/brief";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorEmail = session.user.email ?? session.user.id;

  const body = await req.json();
  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Create local record first to get an ID
  const brief = await prisma.hiringBrief.create({
    data: {
      asanaTaskId: "pending", // will update after Asana call
      roleTitle: data.roleTitle,
      department: data.department,
      hiringManagerEmail: data.hiringManagerEmail,
      employmentType: data.employmentType,
      salaryRangeMin: data.salaryRangeMin,
      salaryRangeMax: data.salaryRangeMax,
      yearsExperience: data.yearsExperience,
      reportingStructure: data.reportingStructure,
      targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
      roleSummary: data.roleSummary,
      jdUploadUrl: data.jdUploadUrl || null,
      aiExpectationsNeeded: data.aiExpectationsNeeded,
      bilingualPostNeeded: data.bilingualPostNeeded,
      hardSkills: data.hardSkills,
      hardSkillsFreeText: data.hardSkillsFreeText,
      softSkills: data.softSkills,
      softSkillsFreeText: data.softSkillsFreeText,
    },
  });

  // Create Asana task — if this fails, clean up the orphaned local record
  let asanaTask: Awaited<ReturnType<typeof createBriefTask>>;
  try {
    asanaTask = await createBriefTask(brief.id, {
      roleTitle: data.roleTitle,
      department: data.department,
      hiringManager: data.hiringManagerEmail,
      employmentType: data.employmentType,
      roleType: "New Role",
      salaryRangeMin: data.salaryRangeMin,
      salaryRangeMax: data.salaryRangeMax,
      targetStartDate: data.targetStartDate,
      roleSummary: data.roleSummary,
    });
  } catch (err) {
    await prisma.hiringBrief.delete({ where: { id: brief.id } });
    console.error("Asana task creation failed — brief rolled back:", err);
    return NextResponse.json(
      { error: "Failed to create Asana task. Please try again." },
      { status: 502 }
    );
  }

  // Update local record with real Asana task GID
  const updated = await prisma.hiringBrief.update({
    where: { id: brief.id },
    data: { asanaTaskId: asanaTask.gid },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail,
      eventType: "BRIEF_SUBMITTED",
      entityId: brief.id,
      entityType: "HiringBrief",
      metadata: { asanaTaskGid: asanaTask.gid, roleTitle: data.roleTitle },
    },
  });

  return NextResponse.json({ id: updated.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // searchParams reserved for future filtering (e.g. ?status=PENDING)
  void new URL(req.url).searchParams;

  const isHR = session.user.role === "HR" || session.user.role === "ADMIN";

  const briefs = await prisma.hiringBrief.findMany({
    where: isHR ? {} : { hiringManagerEmail: session.user.email },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      roleTitle: true,
      department: true,
      approvalStatus: true,
      hiringManagerEmail: true,
      createdAt: true,
      targetStartDate: true,
      jdGeneratedAt: true,
    },
  });

  return NextResponse.json(briefs);
}
