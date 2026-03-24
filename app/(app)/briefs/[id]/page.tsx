import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ApprovalBadge } from "@/components/brief/ApprovalBadge";
import { ApprovalActions } from "@/components/brief/ApprovalActions";

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
  const isApprover = session?.user.role === "APPROVER";

  const canApprove = isApprover || isHR;
  const canGenerateJD = brief.approvalStatus === "APPROVED";

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
              {brief.jdGeneratedAt ? "View job post" : "Generate job post"}
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Role details">
          <Row label="Employment type" value={brief.employmentType} />
          <Row
            label="Salary range"
            value={
              brief.salaryRangeMin && brief.salaryRangeMax
                ? `$${brief.salaryRangeMin.toLocaleString()} – $${brief.salaryRangeMax.toLocaleString()}`
                : brief.salaryRangeMin
                ? `From $${brief.salaryRangeMin.toLocaleString()}`
                : "Not specified"
            }
          />
          <Row
            label="Years of experience"
            value={brief.yearsExperience != null ? String(brief.yearsExperience) : "Not specified"}
          />
          <Row
            label="Target start"
            value={
              brief.targetStartDate
                ? new Date(brief.targetStartDate).toLocaleDateString("en-CA")
                : "Flexible"
            }
          />
          <Row label="Hiring manager" value={brief.hiringManagerEmail} />
        </Section>

        {brief.roleSummary && (
          <Section title="Role summary">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{brief.roleSummary}</p>
          </Section>
        )}

        {(brief.hardSkills || brief.softSkills) && (
          <Section title="Skills">
            {brief.hardSkills && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Hard skills
                </p>
                <p className="text-sm text-gray-700">{brief.hardSkills}</p>
              </div>
            )}
            {brief.softSkills && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Soft skills
                </p>
                <p className="text-sm text-gray-700">{brief.softSkills}</p>
              </div>
            )}
          </Section>
        )}

        {brief.approvalNote && (
          <Section title="Approval note">
            <p className="text-sm text-gray-700">{brief.approvalNote}</p>
            {brief.approverName && (
              <p className="text-xs text-gray-400 mt-2">
                — {brief.approverName},{" "}
                {brief.approvedAt ? new Date(brief.approvedAt).toLocaleDateString("en-CA") : ""}
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
