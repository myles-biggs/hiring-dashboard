import { getDailySnapshotData } from "@/lib/data/reports";
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

export default async function DailySnapshotPage() {
  const today = new Date();

  let data;
  try {
    data = await getDailySnapshotData(today);
  } catch (err) {
    console.error("DailySnapshotPage data fetch failed:", err);
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
        Failed to load report data. Please try again.
      </div>
    );
  }

  const summaryData: Record<string, unknown> = {
    interviewsToday: data.interviewsToday.length,
    scoredToday: data.recentlyScored.length,
    pendingApprovals: data.pendingApprovals,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">
            Daily Snapshot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {today.toLocaleDateString("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <SlackPushButton reportType="daily-snapshot" summaryData={summaryData} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Interviews Today", value: data.interviewsToday.length },
          { label: "Scored Today", value: data.recentlyScored.length },
          { label: "Pending Approvals", value: data.pendingApprovals },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-3xl font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's interviews */}
      <section>
        <h2 className="text-base font-heading font-semibold text-foreground mb-3">
          Interview Schedule
        </h2>
        <Card>
          {data.interviewsToday.length === 0 ? (
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">No interviews scheduled today.</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Interviewers</TableHead>
                  <TableHead>Meet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.interviewsToday.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">
                      {ev.parsed.candidateNameHint ?? ev.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(ev.startIso).toLocaleTimeString("en-CA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ev.parsed.interviewerEmails.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {ev.meetLink ? (
                        <a
                          href={ev.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Join
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      {/* Scored today */}
      <section>
        <h2 className="text-base font-heading font-semibold text-foreground mb-3">
          Scored Today
        </h2>
        <Card>
          {data.recentlyScored.length === 0 ? (
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">No candidates scored today.</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentlyScored.map((m) => (
                  <TableRow key={m.candidateId}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.jobTitle}</TableCell>
                    <TableCell className="text-sm">{m.bucket}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
