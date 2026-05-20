import { getStateOfHiringData } from "@/lib/data/reports";
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

export default async function StateOfHiringPage() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  let data;
  try {
    data = await getStateOfHiringData(from, to);
  } catch (err) {
    console.error("StateOfHiringPage data fetch failed:", err);
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
        Failed to load report data. Please try again.
      </div>
    );
  }

  const summaryData: Record<string, unknown> = {
    openRoles: data.openRoles,
    interviewsThisWeek: data.interviewsThisWeek,
    decisionsNeeded: data.decisionsNeeded,
    topJob: data.topActiveJobs[0]?.title ?? "—",
    topJobCandidates: data.topActiveJobs[0]?.activeCandidates ?? 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">
            State of Hiring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last 7 days — {from.toLocaleDateString("en-CA")} to{" "}
            {to.toLocaleDateString("en-CA")}
          </p>
        </div>
        <SlackPushButton reportType="state-of-hiring" summaryData={summaryData} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Open Roles", value: data.openRoles },
          { label: "Interviews This Week", value: data.interviewsThisWeek },
          { label: "Decisions Needed", value: data.decisionsNeeded },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top active jobs */}
      <section>
        <h2 className="text-base font-heading font-semibold text-foreground mb-3">
          Top Active Jobs
        </h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Shortcode</TableHead>
                <TableHead className="text-right">Active Candidates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topActiveJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-sm">
                    No active jobs.
                  </TableCell>
                </TableRow>
              )}
              {data.topActiveJobs.map((job) => (
                <TableRow key={job.shortcode}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {job.shortcode}
                  </TableCell>
                  <TableCell className="text-right">{job.activeCandidates}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Recent dispositions */}
      {data.recentDispositions.length > 0 && (
        <section>
          <h2 className="text-base font-heading font-semibold text-foreground mb-3">
            Recent Evaluations
          </h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentDispositions.slice(0, 10).map((d) => (
                  <TableRow key={`${d.candidateId}-${d.createdAt.toISOString()}`}>
                    <TableCell className="font-medium">{d.candidateName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {d.jobTitle}
                    </TableCell>
                    <TableCell>{d.recommendation}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {d.createdAt.toLocaleDateString("en-CA")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}
    </div>
  );
}
