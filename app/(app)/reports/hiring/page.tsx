"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelinteractive/ui"

// ── Types ──────────────────────────────────────────────────────────────────────

interface StageCandidate {
  id: string;
  name: string;
  profileUrl?: string;
}

interface JobStage {
  name: string;
  count: number;
  candidates: StageCandidate[];
}

interface JobReport {
  shortcode: string;
  title: string;
  department: string;
  totalCandidates: number;
  activeCandidates: number;
  newInPeriod: number;
  stages: JobStage[];
  topTags: string[];
}

interface ReportData {
  period: { from: string; to: string };
  summary: {
    totalApplications: number;
    newApplicationsInPeriod: number;
    activeJobs: number;
    totalInterviewsScheduled: number;
    totalBriefs: number;
    pendingApprovals: number;
  };
  jobs: JobReport[];
  tagBreakdown: Array<{ tag: string; count: number }>;
  geoBreakdown: {
    canada: number;
    usa: number;
    other: number;
    byCountry: Array<{ country: string; count: number }>;
  };
  aiStats: {
    totalVetted: number;
    avgScore: number;
    qualifiedCount: number;
    unqualifiedCount: number;
    silverMedalists: number;
  };
  interviews: {
    total: number;
    events: Array<{ title: string; date: string; attendeeCount: number }>;
  };
  briefsByDepartment: Array<{ department: string; count: number }>;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = toIsoDate(now);

  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return { from: toIsoDate(from), to: today };
  }

  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 30);
    return { from: toIsoDate(from), to: today };
  }

  if (preset === "current-quarter") {
    const m = now.getMonth();
    const qStart = new Date(now.getFullYear(), Math.floor(m / 3) * 3, 1);
    return { from: toIsoDate(qStart), to: today };
  }

  if (preset === "last-quarter") {
    const m = now.getMonth();
    const currentQStart = Math.floor(m / 3) * 3;
    const lqStart = new Date(now.getFullYear(), currentQStart - 3, 1);
    const lqEnd = new Date(now.getFullYear(), currentQStart, 0);
    return { from: toIsoDate(lqStart), to: toIsoDate(lqEnd) };
  }

  // fallback
  const from = new Date(now);
  from.setDate(now.getDate() - 30);
  return { from: toIsoDate(from), to: today };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface PanelItem {
  id: string;
  name: string;
  role?: string;
  stage?: string;
  profileUrl?: string;
}

interface DrillPanelProps {
  title: string;
  items: PanelItem[];
  onClose: () => void;
}

function DrillPanel({ title, items, onClose }: DrillPanelProps) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end print:hidden" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close panel"
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {items.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-500">No candidates.</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <div>
                  {item.profileUrl ? (
                    <a
                      href={item.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  )}
                  {item.role && (
                    <p className="text-xs text-gray-500">{item.role}</p>
                  )}
                </div>
                {item.stage && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {item.stage}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HiringReportPage() {
  const [preset, setPreset] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(toIsoDate(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ title: string; items: PanelItem[] } | null>(null);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  const fetchReport = useCallback(
    async (from: string, to: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/reports/hiring?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        setData(json as ReportData);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (preset === "custom") return;
    const range = getPresetRange(preset);
    fetchReport(range.from, range.to);
  }, [preset, fetchReport]);

  function handleCustomFetch() {
    if (customFrom && customTo) fetchReport(customFrom, customTo);
  }

  function toggleJob(shortcode: string) {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      next.has(shortcode) ? next.delete(shortcode) : next.add(shortcode);
      return next;
    });
  }

  function openActivePanel() {
    if (!data) return;
    const items: PanelItem[] = data.jobs.flatMap((j) =>
      j.stages.flatMap((s) =>
        s.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          role: j.title,
          stage: s.name,
          profileUrl: c.profileUrl,
        }))
      )
    );
    setPanel({ title: "Active Candidates", items });
  }

  function openInterviewPanel() {
    if (!data) return;
    const items: PanelItem[] = data.interviews.events.map((e, i) => ({
      id: String(i),
      name: e.title,
      role: formatDate(e.date),
      stage: `${e.attendeeCount} attendees`,
    }));
    setPanel({ title: "Interviews", items });
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openTagPanel(tag: string) {
    if (!data) return;
    const items: PanelItem[] = data.jobs.flatMap((j) =>
      j.stages.flatMap((s) =>
        s.candidates
          .filter(() => j.topTags.includes(tag))
          .map((c) => ({
            id: c.id,
            name: c.name,
            role: j.title,
            stage: s.name,
            profileUrl: c.profileUrl,
          }))
      )
    );
    setPanel({ title: `Tag: ${tag}`, items });
  }

  async function sendEmail() {
    if (!data) return;
    setEmailState("sending");
    try {
      const res = await fetch("/api/reports/hiring/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: data.period.from, to: data.period.to }),
      });
      const json = await res.json();
      setEmailState(json.ok ? "sent" : "error");
    } catch {
      setEmailState("error");
    }
  }

  const currentRange =
    preset === "custom"
      ? { from: customFrom, to: customTo }
      : getPresetRange(preset);

  const maxTagCount = data?.tagBreakdown[0]?.count ?? 1;

  return (
    <>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          .print-expand { display: block !important; }
        }
      `}</style>

      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">Hiring Activity Report</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(data.period.from)} &mdash; {formatDate(data.period.to)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Export PDF
            </Button>
            <Button
              size="sm"
              onClick={sendEmail}
              disabled={emailState === "sending" || !data}
            >
              {emailState === "idle" && "Email to CPO & COO"}
              {emailState === "sending" && "Sending..."}
              {emailState === "sent" && "Sent"}
              {emailState === "error" && "Send failed — retry"}
            </Button>
          </div>
        </div>

        {/* Date controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {(["7d", "30d", "current-quarter", "last-quarter", "custom"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? "default" : "outline"}
              onClick={() => setPreset(p)}
            >
              {p === "7d" && "Last 7 days"}
              {p === "30d" && "Last 30 days"}
              {p === "current-quarter" && "Current quarter"}
              {p === "last-quarter" && "Last quarter"}
              {p === "custom" && "Custom"}
            </Button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm border border-input rounded-md px-2 py-1.5 bg-background text-foreground"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm border border-input rounded-md px-2 py-1.5 bg-background text-foreground"
              />
              <Button size="sm" onClick={handleCustomFetch}>
                Apply
              </Button>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading report...</div>
        )}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
            Error loading report: {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  label: "New Applications",
                  value: data.summary.newApplicationsInPeriod,
                  sub: `${currentRange.from ? formatDate(currentRange.from) : ""} period`,
                  onClick: () => scrollToSection("section-pipeline"),
                },
                {
                  label: "Active Candidates",
                  value: data.jobs.reduce((a, j) => a + j.activeCandidates, 0),
                  sub: "across all roles",
                  onClick: openActivePanel,
                },
                {
                  label: "Open Roles",
                  value: data.summary.activeJobs,
                  sub: "published jobs",
                  onClick: () => scrollToSection("section-pipeline"),
                },
                {
                  label: "Interviews Scheduled",
                  value: data.summary.totalInterviewsScheduled,
                  sub: "in period",
                  onClick: openInterviewPanel,
                },
                {
                  label: "Pending Approvals",
                  value: data.summary.pendingApprovals,
                  sub: `of ${data.summary.totalBriefs} total briefs`,
                  onClick: () => scrollToSection("section-briefs"),
                },
              ].map(({ label, value, sub, onClick }) => (
                <Card
                  key={label}
                  onClick={onClick}
                  className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="text-3xl font-semibold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Active roles pipeline */}
            <section id="section-pipeline">
              <h2 className="text-base font-heading font-semibold text-foreground mb-3">Active Roles Pipeline</h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">New (period)</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">Stages</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.jobs.map((job) => (
                      <>
                        <TableRow
                          key={job.shortcode}
                          onClick={() => toggleJob(job.shortcode)}
                          className="cursor-pointer"
                        >
                          <TableCell className="font-medium">
                            {job.title}
                            <span className="ml-2 text-muted-foreground text-xs">
                              {expandedJobs.has(job.shortcode) ? "▲" : "▼"}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{job.department}</TableCell>
                          <TableCell className="text-right">{job.newInPeriod}</TableCell>
                          <TableCell className="text-right">{job.activeCandidates}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {job.stages.map((s) => `${s.name} (${s.count})`).join(" · ")}
                          </TableCell>
                        </TableRow>
                        {expandedJobs.has(job.shortcode) &&
                          job.stages.map((stage) => (
                            <TableRow key={`${job.shortcode}-${stage.name}`} className="bg-muted/30">
                              <TableCell colSpan={5} className="px-8 py-2">
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  {stage.name} ({stage.count})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {stage.candidates.map((c) => (
                                    <a
                                      key={c.id}
                                      href={c.profileUrl ?? "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline bg-background border border-border px-2 py-0.5 rounded-full"
                                    >
                                      {c.name}
                                    </a>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>

            {/* Tag breakdown */}
            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-3">Applications by Tag</h2>
              <Card>
                <CardContent className="p-5 space-y-2">
                  {data.tagBreakdown.slice(0, 15).map(({ tag, count }) => (
                    <div
                      key={tag}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => openTagPanel(tag)}
                    >
                      <span className="text-sm text-foreground w-40 truncate group-hover:text-primary transition-colors">
                        {tag}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${Math.round((count / maxTagCount) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  ))}
                  {data.tagBreakdown.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tags found.</p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Geo breakdown */}
            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-3">Geographic Breakdown</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Canada", flag: "CA", value: data.geoBreakdown.canada },
                  { label: "United States", flag: "US", value: data.geoBreakdown.usa },
                  { label: "Other", flag: "?", value: data.geoBreakdown.other },
                ].map(({ label, flag, value }) => (
                  <Card key={label}>
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl mb-1">{flag === "CA" ? "🇨🇦" : flag === "US" ? "🇺🇸" : "🌍"}</p>
                      <p className="text-3xl font-semibold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {data.geoBreakdown.byCountry.length > 0 && (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Candidates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.geoBreakdown.byCountry.slice(0, 15).map(({ country, count }) => (
                        <TableRow key={country}>
                          <TableCell>{country}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </section>

            {/* Interview activity */}
            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-3">
                Interview Activity
                <span className="ml-2 text-muted-foreground font-normal text-sm">
                  {data.interviews.total} in period
                </span>
              </h2>
              <Card>
                {data.interviews.events.length === 0 ? (
                  <CardContent className="px-5 py-4">
                    <p className="text-sm text-muted-foreground">No interviews found for this period.</p>
                  </CardContent>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                        <TableHead className="text-right">Attendees</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.interviews.events.slice(0, 20).map((ev, i) => (
                        <TableRow key={i}>
                          <TableCell>{ev.title}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatDate(ev.date)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{ev.attendeeCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </section>

            {/* AI vetting stats */}
            <section>
              <h2 className="text-base font-heading font-semibold text-foreground mb-3">AI Vetting Stats</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Total Vetted", value: data.aiStats.totalVetted },
                  { label: "Avg Score", value: data.aiStats.avgScore },
                  {
                    label: "Qualified",
                    value: data.aiStats.qualifiedCount,
                    sub:
                      data.aiStats.totalVetted > 0
                        ? `${Math.round((data.aiStats.qualifiedCount / data.aiStats.totalVetted) * 100)}%`
                        : "—",
                  },
                  { label: "Unqualified", value: data.aiStats.unqualifiedCount },
                  { label: "Silver Medalists", value: data.aiStats.silverMedalists },
                ].map(({ label, value, sub }) => (
                  <Card key={label}>
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-2xl font-semibold text-foreground">{value}</p>
                      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Brief activity */}
            <section id="section-briefs">
              <h2 className="text-base font-heading font-semibold text-foreground mb-3">Brief Activity by Department</h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Briefs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.briefsByDepartment.map(({ department, count }) => (
                      <TableRow key={department}>
                        <TableCell>{department}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{count}</TableCell>
                      </TableRow>
                    ))}
                    {data.briefsByDepartment.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground text-sm">
                          No brief data.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </section>
          </>
        )}
      </div>

      {panel && (
        <DrillPanel
          title={panel.title}
          items={panel.items}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}
