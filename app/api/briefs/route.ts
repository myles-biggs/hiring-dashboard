import { authOptions } from "@/lib/auth/config";
import { createBriefTask } from "@/lib/integrations/asana";
import { briefSchema } from "@/lib/schemas/brief";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Create Asana task
  const asanaTask = await createBriefTask(brief.id, {
    roleTitle: data.roleTitle,
    department: data.department,
    hiringManager: data.hiringManagerEmail,
    employmentType: data.employmentType as "Full Time" | "Part Time",
    roleType: "New Role",
    salaryRangeMin: data.salaryRangeMin,
    salaryRangeMax: data.salaryRangeMax,
    targetStartDate: data.targetStartDate,
    roleSummary: data.roleSummary,
  });

  // Update local record with real Asana task GID
  const updated = await prisma.hiringBrief.update({
    where: { id: brief.id },
    data: { asanaTaskId: asanaTask.gid },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: session.user.email,
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

  const { searchParams } = new URL(req.url);
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
