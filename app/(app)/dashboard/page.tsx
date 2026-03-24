import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getJobs, getCandidatesForJob } from "@/lib/integrations/workable";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ApprovalBadge } from "@/components/brief/ApprovalBadge";
import { HiringBrief } from "@prisma/client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const isHR = session?.user.role === "HR" || session?.user.role === "ADMIN";

  const [briefs, allBriefs] = await Promise.all([
    prisma.hiringBrief.findMany({
      where: isHR ? {} : { hiringManagerEmail: session?.user.email },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    isHR
      ? prisma.hiringBrief.findMany({ select: { approvalStatus: true } })
      : prisma.hiringBrief.findMany({
          where: { hiringManagerEmail: session?.user.email },
          select: { approvalStatus: true },
        }),
  ]);

  // Workable live stats — best-effort
  let activePostings = 0;
  let totalCandidates = 0;
  let candidatesThisWeek = 0;
  try {
    const jobs = await getJobs();
    activePostings = jobs.length;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const candidateCounts = await Promise.all(
      jobs.map((j) => getCandidatesForJob(j.shortcode).catch(() => []))
    );
    for (const candidates of candidateCounts) {
      totalCandidates += candidates.filter((c) => !c.disqualified).length;
      candidatesThisWeek += candidates.filter(
        (c) => !c.disqualified && new Date(c.created_at) > weekAgo
      ).length;
    }
  } catch {
    // Workable unavailable — show what we have
  }

  const pendingApprovals = allBriefs.filter((b) => b.approvalStatus === "PENDING").length;
  const approvedBriefs = allBriefs.filter((b) => b.approvalStatus === "APPROVED").length;
  const totalBriefs = allBriefs.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hiring Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Open roles and pipeline status</p>
        </div>
        <Link
          href="/briefs/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          New brief
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total briefs" value={totalBriefs} />
        <StatCard label="Pending approval" value={pendingApprovals} highlight={pendingApprovals > 0} />
        <StatCard label="Approved" value={approvedBriefs} />
        <StatCard label="Live postings" value={activePostings} href="/postings" />
        <StatCard label="Active candidates" value={totalCandidates} sub={candidatesThisWeek > 0 ? `+${candidatesThisWeek} this week` : undefined} href="/postings" />
      </div>

      {/* Recent briefs */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Recent briefs</h2>
        <Link href="/briefs" className="text-xs text-gray-500 hover:text-gray-700">
          View all →
        </Link>
      </div>

      {briefs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No hiring briefs yet.</p>
          <Link
            href="/briefs/new"
            className="inline-block mt-4 text-sm font-medium text-gray-900 underline"
          >
            Submit the first brief
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {briefs.map((brief: HiringBrief) => (
            <Link
              key={brief.id}
              href={`/briefs/${brief.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{brief.roleTitle}</p>
                <p className="text-sm text-gray-500 mt-0.5">{brief.department}</p>
              </div>
              <div className="flex items-center gap-4">
                {brief.targetStartDate && (
                  <p className="text-xs text-gray-400">
                    Start {new Date(brief.targetStartDate).toLocaleDateString("en-CA")}
                  </p>
                )}
                <ApprovalBadge status={brief.approvalStatus} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`bg-white rounded-xl border p-5 ${
        highlight ? "border-amber-300 bg-amber-50" : "border-gray-200"
      }`}
    >
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-green-600 mt-0.5 font-medium">{sub}</p>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
