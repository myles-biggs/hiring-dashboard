import { getPipelineReportData } from "@/lib/data/reports";
import { SlackPushButton } from "@/components/reports/SlackPushButton";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelinteractive/ui";

export default async function PipelineReportPage() {
  const to = new Date();
  const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);

  let data;
  try {
    data = await getPipelineReportData(from, to);
  } catch (err) {
    console.error("PipelineReportPage data fetch failed:", err);
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
        Failed to load report data. Please try again.
      </div>
    );
  }

  const summaryData: Record<string, unknown> = {
    totalActive: data.totalActive,
    openJobs: data.byJob.length,
    qualifiedRate: `${Math.round(data.qualifiedRate * 100)}%`,
    topJob: data.byJob[0]?.title ?? "—",
    topJobScore: data.byJob[0]?.avgScore ?? "—",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">
            Pipeline Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last 14 days — {from.toLocaleDateString("en-CA")} to{" "}
            {to.toLocaleDateString("en-CA")}
          </p>
        </div>
        <SlackPushButton reportType="pipeline" summaryData={summaryData} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Active Candidates", value: data.totalActive },
          { label: "Open Jobs", value: data.byJob.length },
          {
            label: "Qualified Rate",
            value: `${Math.round(data.qualifiedRate * 100)}%`,
          },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By job table */}
      <section>
        <h2 className="text-base font-heading font-semibold text-foreground mb-3">
          Pipeline by Job
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Avg AI Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byJob.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-sm">
                    No active jobs.
                  </TableCell>
                </TableRow>
              )}
              {data.byJob.map((job) => (
                <TableRow key={job.shortcode}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell className="text-muted-foreground">{job.department}</TableCell>
                  <TableCell className="text-right">{job.activeCandidates}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {job.avgScore !== null ? job.avgScore : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Sourcing mix */}
      <section>
        <h2 className="text-base font-heading font-semibold text-foreground mb-3">
          Sourcing Mix
        </h2>
        <Card>
          <CardContent className="p-5 space-y-2">
            {Object.keys(data.sourcingMix).length === 0 && (
              <p className="text-sm text-muted-foreground">No sourcing data.</p>
            )}
            {Object.entries(data.sourcingMix)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => {
                const total = Object.values(data.sourcingMix).reduce(
                  (a, b) => a + b,
                  0
                );
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span className="text-sm text-foreground w-32 truncate">{source}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-16 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
