import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@levelinteractive/ui";

const REPORT_TILES = [
  {
    href: "/reports/state-of-hiring",
    title: "State of Hiring",
    description: "Weekly snapshot — open roles, interviews, decisions needed, and top active jobs.",
    cadence: "Weekly",
  },
  {
    href: "/reports/daily-snapshot",
    title: "Daily Snapshot",
    description: "Today's interview schedule, pipeline movement, and pending approvals.",
    cadence: "Daily",
  },
  {
    href: "/reports/pipeline",
    title: "Pipeline Report",
    description: "Bi-weekly pipeline overview with AI scores, sourcing mix, and qualified rate.",
    cadence: "Bi-weekly",
  },
  {
    href: "/reports/hiring",
    title: "Hiring Activity Report",
    description: "Full period report with stage breakdown, geo, tags, and AI vetting stats.",
    cadence: "On demand",
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hiring pipeline reports and snapshots for Level Agency.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="group">
            <Card className="h-full hover:border-primary/40 hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {tile.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{tile.description}</p>
                <span className="inline-block text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {tile.cadence}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
