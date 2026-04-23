import { prisma } from "@/lib/utils/prisma"
import { getJobs, getCandidatesForJob } from "@/lib/integrations/workable"
import Link from "next/link"
import { ApprovalBadge } from "@/components/brief/ApprovalBadge"
import { HiringBrief } from "@prisma/client"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@levelinteractive/ui"

export default async function DashboardPage() {
  const [briefs, allBriefs] = await Promise.all([
    prisma.hiringBrief.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.hiringBrief.findMany({ select: { approvalStatus: true } }),
  ])

  // Workable live stats — best-effort
  let activePostings = 0
  let totalCandidates = 0
  let candidatesThisWeek = 0
  try {
    const jobs = await getJobs()
    activePostings = jobs.length
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const candidateCounts = await Promise.all(
      jobs.map((j) => getCandidatesForJob(j.shortcode).catch(() => []))
    )
    for (const candidates of candidateCounts) {
      totalCandidates += candidates.filter((c) => !c.disqualified).length
      candidatesThisWeek += candidates.filter(
        (c) => !c.disqualified && new Date(c.created_at) > weekAgo
      ).length
    }
  } catch {
    // Workable unavailable — show what we have
  }

  const pendingApprovals = allBriefs.filter((b) => b.approvalStatus === "PENDING").length
  const approvedBriefs = allBriefs.filter((b) => b.approvalStatus === "APPROVED").length
  const totalBriefs = allBriefs.length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">Hiring Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Open roles and pipeline status</p>
        </div>
        <Button asChild>
          <Link href="/briefs/new">New brief</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total briefs" value={totalBriefs} />
        <StatCard label="Pending approval" value={pendingApprovals} highlight={pendingApprovals > 0} />
        <StatCard label="Approved" value={approvedBriefs} />
        <StatCard label="Live postings" value={activePostings} href="/postings" />
        <StatCard
          label="Active candidates"
          value={totalCandidates}
          sub={candidatesThisWeek > 0 ? `+${candidatesThisWeek} this week` : undefined}
          href="/postings"
        />
      </div>

      {/* Recent briefs */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Recent briefs</h2>
        <Link href="/briefs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all →
        </Link>
      </div>

      {briefs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-sm">No hiring briefs yet.</p>
            <Link
              href="/briefs/new"
              className="inline-block mt-4 text-sm font-medium text-foreground underline"
            >
              Submit the first brief
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {briefs.map((brief: HiringBrief) => (
            <Link
              key={brief.id}
              href={`/briefs/${brief.id}`}
              className="block"
            >
              <Card className="hover:border-border/80 transition-colors">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{brief.roleTitle}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{brief.department}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {brief.targetStartDate && (
                      <p className="text-xs text-muted-foreground">
                        Start {new Date(brief.targetStartDate).toLocaleDateString("en-CA")}
                      </p>
                    )}
                    <ApprovalBadge status={brief.approvalStatus} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  href,
}: {
  label: string
  value: number
  sub?: string
  highlight?: boolean
  href?: string
}) {
  const content = (
    <Card className={highlight ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : ""}>
      <CardContent className="p-5">
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-xs text-green-600 mt-0.5 font-medium">{sub}</p>}
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}
