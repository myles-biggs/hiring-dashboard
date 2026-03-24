import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ApprovalBadge } from "@/components/brief/ApprovalBadge";
import { ApprovalActions } from "@/components/brief/ApprovalActions";
import {
  HARD_SKILL_LABELS,
  SOFT_SKILL_LABELS,
} from "@/lib/schemas/brief";

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const brief = await prisma.hiringBrief.findUnique({ where: { id } });

  if (!brief) notFound();

  const isHR = session?.user.role === "HR" || session?.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session?.user.email;
  const isApprover = session?.user.role === "APPROVER";

  if (!isHR && !isOwner && !isApprover) notFound();

  const canApprove = isApprover || isHR;
  const canGenerateJD = (isHR || isOwner) && brief.approvalStatus === "APPROVED";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/briefs" className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← All briefs
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">{brief.roleTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">{brief.department}</p>
        </div>
        <div className="flex items-center gap-3">
          <ApprovalBadge status={brief.approvalStatus} />
          {canGenerateJD && (
            <Link
              href={`/briefs/${brief.id}/jd`}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              {brief.jdGeneratedAt ? "View JD" : "Generate JD"}
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Role details">
          <Row label="Employment type" value={brief.employmentType} />
          <Row label="Salary range" value={
            brief.salaryRangeMin && brief.salaryRangeMax
              ? `$${brief.salaryRangeMin.toLocaleString()} – $${brief.salaryRangeMax.toLocaleString()}`
              : brief.salaryRangeMin
              ? `From $${brief.salaryRangeMin.toLocaleString()}`
              : "Not specified"
          } />
          <Row label="Years of experience" value={brief.yearsExperience} />
          <Row label="Reporting to" value={brief.reportingStructure} />
          <Row label="Target start" value={
            brief.targetStartDate
              ? new Date(brief.targetStartDate).toLocaleDateString("en-CA")
              : "Flexible"
          } />
          <Row label="Hiring manager" value={brief.hiringManagerEmail} />
        </Section>

        {brief.roleSummary && (
          <Section title="Role summary">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{brief.roleSummary}</p>
          </Section>
        )}

        <Section title="Skills">
          {brief.hardSkills.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Hard skills</p>
              <div className="flex flex-wrap gap-2">
                {brief.hardSkills.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {HARD_SKILL_LABELS[s as keyof typeof HARD_SKILL_LABELS] ?? s}
                  </span>
                ))}
                {brief.hardSkillsFreeText && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {brief.hardSkillsFreeText}
                  </span>
                )}
              </div>
            </div>
          )}
          {brief.softSkills.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Soft skills</p>
              <div className="flex flex-wrap gap-2">
                {brief.softSkills.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {SOFT_SKILL_LABELS[s as keyof typeof SOFT_SKILL_LABELS] ?? s}
                  </span>
                ))}
                {brief.softSkillsFreeText && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {brief.softSkillsFreeText}
                  </span>
                )}
              </div>
            </div>
          )}
        </Section>

        <Section title="Post options">
          <Row label="AI expectations section" value={brief.aiExpectationsNeeded ? "Yes" : "No"} />
          <Row label="Bilingual post (EN + FR)" value={brief.bilingualPostNeeded ? "Yes" : "No"} />
        </Section>

        {brief.approvalNote && (
          <Section title="Approval note">
            <p className="text-sm text-gray-700">{brief.approvalNote}</p>
            {brief.approverName && (
              <p className="text-xs text-gray-400 mt-2">
                — {brief.approverName}, {brief.approvedAt ? new Date(brief.approvedAt).toLocaleDateString("en-CA") : ""}
              </p>
            )}
          </Section>
        )}

        {canApprove && brief.approvalStatus === "PENDING" && (
          <ApprovalActions briefId={brief.id} />
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
