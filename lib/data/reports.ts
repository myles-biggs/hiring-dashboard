import "server-only";

import { listPublishedJobs } from "@/lib/integrations/workable";
import { listHiringCalendarEvents } from "@/lib/integrations/google-calendar";
import type { HiringCalendarEvent } from "@/lib/integrations/google-calendar";
import { prisma } from "@/lib/utils/prisma";
import { EvaluationType } from "@prisma/client";

// ── Return types ───────────────────────────────────────────────────────────────

export interface RecentDisposition {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  recommendation: string;
  createdAt: Date;
}

export interface StateOfHiringData {
  openRoles: number;
  interviewsThisWeek: number;
  decisionsNeeded: number;
  recentDispositions: RecentDisposition[];
  topActiveJobs: { shortcode: string; title: string; activeCandidates: number }[];
}

export interface DailySnapshotData {
  interviewsToday: HiringCalendarEvent[];
  recentlyScored: { candidateId: string; name: string; jobTitle: string; bucket: string }[];
  pendingApprovals: number;
}

export interface PipelineReportData {
  totalActive: number;
  byJob: {
    shortcode: string;
    title: string;
    department: string;
    activeCandidates: number;
    avgScore: number | null;
  }[];
  sourcingMix: Record<string, number>;
  qualifiedRate: number;
}

export interface FinalInterviewBrief {
  resumeUrl: string | null;
  evaluationSummary: string | null;
  cultureScore: number | null;
  jdScore: number | null;
  interviewPanel: string[];
  valuesAlignment: string | null;
}

// ── State of Hiring ────────────────────────────────────────────────────────────

export async function getStateOfHiringData(
  from: Date,
  to: Date
): Promise<StateOfHiringData> {
  const [jobs, calendarEvents, decisionsNeeded, recentDispositionsRaw, candidateCounts] =
    await Promise.all([
      // One Workable call for job metadata — not per-candidate
      listPublishedJobs().catch(() => []),
      listHiringCalendarEvents(from, to).catch((err) => {
        console.error("Calendar fetch failed:", err);
        return [] as HiringCalendarEvent[];
      }),
      // Decisions needed = RECOMMENDED dispositions awaiting human action
      prisma.disposition.count({ where: { status: "RECOMMENDED" } }),
      // Recent dispositions from DB — no Workable call needed
      prisma.disposition.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          candidate: { select: { fullName: true, workableJobTitle: true } },
        },
      }),
      // Active candidate counts per job from DB
      prisma.candidate.groupBy({
        by: ["workableJobShortcode", "workableJobTitle"],
        _count: { id: true },
      }),
    ]);

  const recentDispositions: RecentDisposition[] = recentDispositionsRaw.map((d) => ({
    candidateId: d.candidateId,
    candidateName: d.candidate.fullName,
    jobTitle: d.candidate.workableJobTitle,
    recommendation: d.recommendedAction,
    createdAt: d.createdAt,
  }));

  const topActiveJobs = candidateCounts
    .map((row) => ({
      shortcode: row.workableJobShortcode,
      title: row.workableJobTitle,
      activeCandidates: row._count.id,
    }))
    .sort((a, b) => b.activeCandidates - a.activeCandidates)
    .slice(0, 5);

  return {
    openRoles: jobs.length,
    interviewsThisWeek: calendarEvents.length,
    decisionsNeeded,
    recentDispositions,
    topActiveJobs,
  };
}

// ── Daily Snapshot ─────────────────────────────────────────────────────────────

export async function getDailySnapshotData(date: Date): Promise<DailySnapshotData> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [calendarEvents, recentEvals, pendingApprovals] = await Promise.all([
    listHiringCalendarEvents(dayStart, dayEnd).catch((err) => {
      console.error("Calendar fetch failed:", err);
      return [] as HiringCalendarEvent[];
    }),
    // Candidates scored today
    prisma.evaluation.findMany({
      where: {
        type: EvaluationType.JOB_POSTING_FIT,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        candidate: { select: { fullName: true, workableJobTitle: true } },
      },
    }),
    prisma.disposition.count({ where: { status: "RECOMMENDED" } }),
  ]);

  const recentlyScored = recentEvals.map((e) => ({
    candidateId: e.candidateId,
    name: e.candidate.fullName,
    jobTitle: e.candidate.workableJobTitle,
    bucket: e.bucket,
  }));

  const now = new Date();
  const interviewsToday = calendarEvents.filter((ev) => {
    const d = new Date(ev.startIso);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  return {
    interviewsToday,
    recentlyScored,
    pendingApprovals,
  };
}

// ── Pipeline Report ────────────────────────────────────────────────────────────

export async function getPipelineReportData(
  from: Date,
  to: Date
): Promise<PipelineReportData> {
  const [jobs, candidateCounts, evalScores] = await Promise.all([
    // One Workable call for department metadata — not per-candidate
    listPublishedJobs().catch(() => []),
    // Candidate counts per job from DB
    prisma.candidate.groupBy({
      by: ["workableJobShortcode"],
      _count: { id: true },
    }),
    // JD scores per job from DB
    prisma.evaluation.findMany({
      where: { type: EvaluationType.JOB_POSTING_FIT, createdAt: { gte: from, lte: to } },
      select: {
        score: true,
        bucket: true,
        candidate: { select: { workableJobShortcode: true, applicationSource: true } },
      },
    }),
  ]);

  // Build lookup maps
  const countByJob = new Map(candidateCounts.map((r) => [r.workableJobShortcode, r._count.id]));
  const jobMeta = new Map(jobs.map((j) => [j.shortcode, j]));

  // Aggregate scores and sourcing per job
  const scoresByJob = new Map<string, number[]>();
  const sourcingMix: Record<string, number> = {};
  let totalQualified = 0;

  for (const e of evalScores) {
    const sc = e.candidate.workableJobShortcode;
    if (!scoresByJob.has(sc)) scoresByJob.set(sc, []);
    scoresByJob.get(sc)!.push(e.score);
    if (e.bucket === "STRONG" || e.bucket === "POSSIBLE") totalQualified++;

    const source = e.candidate.applicationSource ?? "Unknown";
    sourcingMix[source] = (sourcingMix[source] ?? 0) + 1;
  }

  let totalActive = 0;
  const byJob: PipelineReportData["byJob"] = [];

  for (const [shortcode, count] of countByJob) {
    totalActive += count;
    const meta = jobMeta.get(shortcode);
    const scores = scoresByJob.get(shortcode) ?? [];
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    byJob.push({
      shortcode,
      title: meta?.title ?? shortcode,
      department: meta?.department ?? "",
      activeCandidates: count,
      avgScore,
    });
  }

  const qualifiedRate =
    evalScores.length > 0
      ? Math.round((totalQualified / evalScores.length) * 100) / 100
      : 0;

  return {
    totalActive,
    byJob: byJob.sort((a, b) => b.activeCandidates - a.activeCandidates),
    sourcingMix,
    qualifiedRate,
  };
}

// ── Final Interview Brief ──────────────────────────────────────────────────────

export async function getFinalInterviewBrief(
  candidateId: string
): Promise<FinalInterviewBrief | null> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      evaluations: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) return null;

  const jdEval = candidate.evaluations.find((e) => e.type === EvaluationType.JOB_POSTING_FIT);
  const cultureEval = candidate.evaluations.find((e) => e.type === EvaluationType.CULTURE_FIT);

  // Interview panel from calendar — best effort
  let interviewPanel: string[] = [];
  try {
    const now = new Date();
    const lookAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const events = await listHiringCalendarEvents(now, lookAhead);
    const nameLower = candidate.fullName.toLowerCase();
    const match = events.find((ev) => {
      const hint = ev.parsed.candidateNameHint?.toLowerCase() ?? "";
      return hint && nameLower.includes(hint.split(" ")[0] ?? "");
    });
    if (match) interviewPanel = match.parsed.interviewerEmails;
  } catch {
    // Calendar unavailable — leave panel empty
  }

  // Values alignment from culture eval dimension scores
  let valuesAlignment: string | null = null;
  if (cultureEval?.dimensionScores) {
    const dims = cultureEval.dimensionScores as Record<string, number>;
    valuesAlignment = [
      `No Ego All In: ${dims.noEgoAllIn ?? "—"}/5`,
      `Better Every Day: ${dims.betterEveryDay ?? "—"}/5`,
      `Relentless for Results: ${dims.relentlessForResults ?? "—"}/5`,
      `Driven by Truth: ${dims.drivenByTruth ?? "—"}/5`,
    ].join(" | ");
  }

  return {
    resumeUrl: candidate.resumeUrl,
    evaluationSummary: jdEval?.rationale ?? null,
    cultureScore: cultureEval?.score ?? null,
    jdScore: jdEval?.score ?? null,
    interviewPanel,
    valuesAlignment,
  };
}
