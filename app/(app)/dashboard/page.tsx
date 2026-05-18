import { getJobs, getCandidatesForJob } from "@/lib/integrations/workable"
import Link from "next/link"
import {
  Card,
  CardContent,
} from "@levelinteractive/ui"

export default async function DashboardPage() {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-semibold text-foreground">Hiring Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Open roles and pipeline status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-8">
        <StatCard label="Live postings" value={activePostings} href="/postings" />
        <StatCard
          label="Active candidates"
          value={totalCandidates}
          sub={candidatesThisWeek > 0 ? `+${candidatesThisWeek} this week` : undefined}
          href="/postings"
        />
      </div>
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
