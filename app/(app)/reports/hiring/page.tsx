"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
            <h1 className="text-2xl font-semibold text-gray-900">Hiring Activity Report</h1>
            {data && (
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(data.period.from)} &mdash; {formatDate(data.period.to)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              Export PDF
            </button>
            <button
              onClick={sendEmail}
              disabled={emailState === "sending" || !data}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {emailState === "idle" && "Email to CPO & COO"}
              {emailState === "sending" && "Sending..."}
              {emailState === "sent" && "Sent"}
              {emailState === "error" && "Send failed — retry"}
            </button>
          </div>
        </div>

        {/* Date controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {(["7d", "30d", "current-quarter", "last-quarter", "custom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                preset === p
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p === "7d" && "Last 7 days"}
              {p === "30d" && "Last 30 days"}
              {p === "current-quarter" && "Current quarter"}
              {p === "last-quarter" && "Last quarter"}
              {p === "custom" && "Custom"}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
              />
              <button
                onClick={handleCustomFetch}
                className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-sm text-gray-500 py-8 text-center">Loading report...</div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
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
                  onClick: undefined,
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
                  onClick: undefined,
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
                  onClick: undefined,
                },
              ].map(({ label, value, sub, onClick }) => (
                <div
                  key={label}
                  onClick={onClick}
                  className={`bg-white rounded-xl border border-gray-200 p-5 ${
                    onClick ? "cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all" : ""
                  }`}
                >
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="text-3xl font-semibold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </div>
              ))}
            </div>

            {/* Active roles pipeline */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Active Roles Pipeline</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Department</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">New (period)</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Active</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Stages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.map((job) => (
                      <>
                        <tr
                          key={job.shortcode}
                          onClick={() => toggleJob(job.shortcode)}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-5 py-3 text-gray-900 font-medium">
                            {job.title}
                            <span className="ml-2 text-gray-400 text-xs">
                              {expandedJobs.has(job.shortcode) ? "▲" : "▼"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{job.department}</td>
                          <td className="px-5 py-3 text-right text-gray-900">{job.newInPeriod}</td>
                          <td className="px-5 py-3 text-right text-gray-900">{job.activeCandidates}</td>
                          <td className="px-5 py-3 text-right text-gray-500 text-xs">
                            {job.stages.map((s) => `${s.name} (${s.count})`).join(" · ")}
                          </td>
                        </tr>
                        {expandedJobs.has(job.shortcode) &&
                          job.stages.map((stage) => (
                            <tr key={`${job.shortcode}-${stage.name}`} className="border-b border-gray-50 bg-gray-50/50">
                              <td colSpan={5} className="px-8 py-2">
                                <div className="text-xs font-medium text-gray-500 mb-1">
                                  {stage.name} ({stage.count})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {stage.candidates.map((c) => (
                                    <a
                                      key={c.id}
                                      href={c.profileUrl ?? "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline bg-white border border-gray-200 px-2 py-0.5 rounded-full"
                                    >
                                      {c.name}
                                    </a>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tag breakdown */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Applications by Tag</h2>
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
                {data.tagBreakdown.slice(0, 15).map(({ tag, count }) => (
                  <div
                    key={tag}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => openTagPanel(tag)}
                  >
                    <span className="text-sm text-gray-700 w-40 truncate group-hover:text-blue-600">
                      {tag}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.round((count / maxTagCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                  </div>
                ))}
                {data.tagBreakdown.length === 0 && (
                  <p className="text-sm text-gray-400">No tags found.</p>
                )}
              </div>
            </section>

            {/* Geo breakdown */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Geographic Breakdown</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Canada", flag: "CA", value: data.geoBreakdown.canada },
                  { label: "United States", flag: "US", value: data.geoBreakdown.usa },
                  { label: "Other", flag: "?", value: data.geoBreakdown.other },
                ].map(({ label, flag, value }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                    <p className="text-2xl mb-1">{flag === "CA" ? "🇨🇦" : flag === "US" ? "🇺🇸" : "🌍"}</p>
                    <p className="text-3xl font-semibold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
              {data.geoBreakdown.byCountry.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-5 py-3 font-medium text-gray-500">Country</th>
                        <th className="text-right px-5 py-3 font-medium text-gray-500">Candidates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.geoBreakdown.byCountry.slice(0, 15).map(({ country, count }) => (
                        <tr key={country} className="border-b border-gray-100 last:border-0">
                          <td className="px-5 py-3 text-gray-900">{country}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Interview activity */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Interview Activity
                <span className="ml-2 text-gray-400 font-normal text-sm">
                  {data.interviews.total} in period
                </span>
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {data.interviews.events.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">No interviews found for this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-5 py-3 font-medium text-gray-500">Event</th>
                        <th className="text-right px-5 py-3 font-medium text-gray-500">Date</th>
                        <th className="text-right px-5 py-3 font-medium text-gray-500">Attendees</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.interviews.events.slice(0, 20).map((ev, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-5 py-3 text-gray-900">{ev.title}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{formatDate(ev.date)}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{ev.attendeeCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* AI vetting stats */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">AI Vetting Stats</h2>
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
                  <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-2xl font-semibold text-gray-900">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            </section>

            {/* Brief activity */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Brief Activity by Department</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Department</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Briefs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.briefsByDepartment.map(({ department, count }) => (
                      <tr key={department} className="border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3 text-gray-900">{department}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{count}</td>
                      </tr>
                    ))}
                    {data.briefsByDepartment.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-5 py-4 text-gray-400 text-sm">
                          No brief data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
