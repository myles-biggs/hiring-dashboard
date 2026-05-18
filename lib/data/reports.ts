import "server-only";

import { prisma } from "@/lib/utils/prisma";
import { getJobs, getCandidatesForJob } from "@/lib/integrations/workable";
import { listHiringCalendarEvents } from "@/lib/integrations/google-calendar";
import type { HiringCalendarEvent } from "@/lib/integrations/google-calendar";

// ── Return types ───────────────────────────────────────────────────────────────

export interface RecentDisposition {
  candidateId: string;
  candidateName: string;
  jobShortcode: string;
  recommendation: string;
  createdAt: Date;
}

export interface StateOfHiringData {
  openRoles: number;
  interviewsThisWeek: number;
  decisionsNeeded: number;
  candidatesByStage: Record<string, number>;
  recentDispositions: RecentDisposition[];
  topActiveJobs: { shortcode: string; title: string; activeCandidates: number }[];
}

export interface DailySnapshotData {
  interviewsToday: HiringCalendarEvent[];
  pipelineMovement: { candidateId: string; name: string; fromStage: string | null; toStage: string }[];
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
  sourcingMix: Record<string, number>; // TODO: verify against spec
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── State of Hiring ────────────────────────────────────────────────────────────

export async function getStateOfHiringData(
  from: Date,
  to: Date
): Promise<StateOfHiringData> {
  // Workable: open roles + candidates
  const [allJobs, calendarEvents, dispositionCount, recentDispositionsRaw] =
    await Promise.all([
      getJobs(),
      // Calendar: interview count this week
      listHiringCalendarEvents(from, to).catch((err) => {
        console.error("Calendar fetch failed in getStateOfHiringData:", err);
        return [] as HiringCalendarEvent[];
      }),
      // Prisma: decisions needed = evaluations where recommendation is "recommend" or equivalent
      // TODO: verify against spec — using CandidateEvaluation.meetsThreshold as proxy
      prisma.candidateEvaluation.count({
        where: { meetsThreshold: true, workableCommentPosted: false },
      }),
      prisma.candidateEvaluation.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          workableCandidateId: true,
          workableJobId: true,
          recommendation: true,
          createdAt: true,
        },
      }),
    ]);

  const activeJobs = allJobs.filter((j) => j.state === "published");

  // Build candidates-by-stage and top active jobs
  const candidatesByStage: Record<string, number> = {};
  const jobActivity: { shortcode: string; title: string; activeCandidates: number }[] = [];

  // Fetch candidates for all active jobs in parallel (capped to avoid rate limits)
  // TODO: verify against spec — may want to limit to top N jobs
  const jobCandidates = await Promise.allSettled(
    activeJobs.map(async (job) => {
      const candidates = await getCandidatesForJob(job.shortcode);
      return { job, candidates };
    })
  );

  for (const result of jobCandidates) {
    if (result.status === "rejected") continue;
    const { job, candidates } = result.value;
    const active = candidates.filter((c) => !c.disqualified);

    for (const c of active) {
      const stage = c.stage?.name ?? "Unknown";
      candidatesByStage[stage] = (candidatesByStage[stage] ?? 0) + 1;
    }

    jobActivity.push({ shortcode: job.shortcode, title: job.title, activeCandidates: active.length });
  }

  const topActiveJobs = jobActivity
    .sort((a, b) => b.activeCandidates - a.activeCandidates)
    .slice(0, 5);

  // Map recent disposition rows — no candidate name in evaluation table, use ID
  const recentDispositions: RecentDisposition[] = recentDispositionsRaw.map((d) => ({
    candidateId: d.workableCandidateId,
    candidateName: d.workableCandidateId, // TODO: verify against spec — join with CandidateCache once name is available
    jobShortcode: d.workableJobId,
    recommendation: d.recommendation,
    createdAt: d.createdAt,
  }));

  // Resolve candidate names from CandidateCache where available
  const candidateIds = recentDispositionsRaw.map((d) => d.workableCandidateId);
  const cachedNames = await prisma.candidateCache.findMany({
    where: { workableCandidateId: { in: candidateIds } },
    select: { workableCandidateId: true, name: true },
  });
  const nameMap = new Map(cachedNames.map((c) => [c.workableCandidateId, c.name]));
  for (const d of recentDispositions) {
    d.candidateName = nameMap.get(d.candidateId) ?? d.candidateId;
  }

  return {
    openRoles: activeJobs.length,
    interviewsThisWeek: calendarEvents.length,
    decisionsNeeded: dispositionCount,
    candidatesByStage,
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
      console.error("Calendar fetch failed in getDailySnapshotData:", err);
      return [] as HiringCalendarEvent[];
    }),
    // Pipeline movement: evaluations created today indicate a stage decision
    // TODO: verify against spec — may want a dedicated stage-move event log
    prisma.candidateEvaluation.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        workableCandidateId: true,
        pipelineStage: true,
        createdAt: true,
      },
    }),
    prisma.hiringBrief.count({ where: { approvalStatus: "PENDING" } }),
  ]);

  // Resolve candidate names
  const candidateIds = recentEvals.map((e) => e.workableCandidateId);
  const cachedCandidates = await prisma.candidateCache.findMany({
    where: { workableCandidateId: { in: candidateIds } },
    select: { workableCandidateId: true, name: true, currentStage: true },
  });
  const candidateMap = new Map(
    cachedCandidates.map((c) => [c.workableCandidateId, c])
  );

  const pipelineMovement = recentEvals.map((e) => {
    const cached = candidateMap.get(e.workableCandidateId);
    return {
      candidateId: e.workableCandidateId,
      name: cached?.name ?? e.workableCandidateId,
      fromStage: null as string | null, // TODO: verify against spec — no prior-stage field in current schema
      toStage: e.pipelineStage,
    };
  });

  const interviewsToday = calendarEvents.filter((ev) => isToday(ev.startIso));

  return {
    interviewsToday,
    pipelineMovement,
    pendingApprovals,
  };
}

// ── Pipeline Report ────────────────────────────────────────────────────────────

export async function getPipelineReportData(
  from: Date,
  to: Date
): Promise<PipelineReportData> {
  const allJobs = await getJobs();
  const activeJobs = allJobs.filter((j) => j.state === "published");

  // Fetch AI scores per job from CandidateCache — filtered to the report window
  // TODO: verify against spec — aiVetRunAt filters scores to the requested period
  const scoreRows = await prisma.candidateCache.findMany({
    where: { aiVetScore: { not: null }, aiVetRunAt: { gte: from, lte: to } },
    select: { workableJobId: true, aiVetScore: true, aiVetStatus: true },
  });

  const scoresByJob = new Map<
    string,
    { scores: number[]; qualifiedCount: number }
  >();
  for (const row of scoreRows) {
    if (!scoresByJob.has(row.workableJobId)) {
      scoresByJob.set(row.workableJobId, { scores: [], qualifiedCount: 0 });
    }
    const entry = scoresByJob.get(row.workableJobId)!;
    if (row.aiVetScore !== null) entry.scores.push(row.aiVetScore);
    if (row.aiVetStatus?.toLowerCase() === "qualified") entry.qualifiedCount++;
  }

  const byJob: PipelineReportData["byJob"] = [];
  const sourcingMix: Record<string, number> = {};
  let totalActive = 0;
  let totalQualified = 0;
  let totalVetted = 0;

  const jobCandidates = await Promise.allSettled(
    activeJobs.map(async (job) => {
      const candidates = await getCandidatesForJob(job.shortcode);
      return { job, candidates };
    })
  );

  for (const result of jobCandidates) {
    if (result.status === "rejected") continue;
    const { job, candidates } = result.value;
    const active = candidates.filter((c) => !c.disqualified);
    totalActive += active.length;

    // Sourcing mix — sourced flag is the only signal available without full candidate detail
    // TODO: verify against spec — Workable candidate detail has a source field
    for (const c of active) {
      const source = c.sourced ? "Sourced" : "Applied";
      sourcingMix[source] = (sourcingMix[source] ?? 0) + 1;
    }

    const jobScoreData = scoresByJob.get(job.shortcode);
    const scores = jobScoreData?.scores ?? [];
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    totalQualified += jobScoreData?.qualifiedCount ?? 0;
    totalVetted += scores.length;

    byJob.push({
      shortcode: job.shortcode,
      title: job.title,
      department: job.department,
      activeCandidates: active.length,
      avgScore,
    });
  }

  const qualifiedRate =
    totalVetted > 0 ? Math.round((totalQualified / totalVetted) * 100) / 100 : 0;

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
  const cached = await prisma.candidateCache.findUnique({
    where: { workableCandidateId: candidateId },
    select: {
      name: true,
      resumeUrl: true,
      aiVetSummary: true,
      aiVetScore: true,
      currentStage: true,
    },
  });

  if (!cached) return null;

  // Only build brief for candidates at final interview stages
  // TODO: verify against spec — stage name matching may need to align with Workable stage config
  const isFinalStage =
    /final|offer|executive/i.test(cached.currentStage ?? "");
  if (!isFinalStage) return null;

  // Latest evaluation for values alignment
  const latestEval = await prisma.candidateEvaluation.findFirst({
    where: { workableCandidateId: candidateId },
    orderBy: { createdAt: "desc" },
    select: {
      cvTruth: true,
      cvResults: true,
      cvBetterEveryDay: true,
      cvNoEgo: true,
      notes: true,
    },
  });

  // Build values alignment summary from evaluation CV fields
  const valuesAlignment = latestEval
    ? [
        `Truth: ${latestEval.cvTruth}`,
        `Results: ${latestEval.cvResults}`,
        `Better Every Day: ${latestEval.cvBetterEveryDay}`,
        `No Ego: ${latestEval.cvNoEgo}`,
      ].join(" | ")
    : null;

  // Find interview panel from calendar
  // TODO: verify against spec — name matching is fuzzy; extend with Slack homework lookup once spec available
  const now = new Date();
  const lookAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  let interviewPanel: string[] = [];

  try {
    const events = await listHiringCalendarEvents(now, lookAhead);
    const candidateName = cached.name.toLowerCase();
    const matchingEvent = events.find((ev) => {
      const hint = ev.parsed.candidateNameHint?.toLowerCase() ?? "";
      return hint && candidateName.includes(hint.split(" ")[0] ?? "");
    });
    if (matchingEvent) {
      interviewPanel = matchingEvent.parsed.interviewerEmails;
    }
  } catch (err) {
    console.error("Calendar lookup failed in getFinalInterviewBrief:", err);
  }

  return {
    resumeUrl: cached.resumeUrl,
    evaluationSummary: latestEval?.notes ?? cached.aiVetSummary ?? null,
    cultureScore: null, // TODO: verify against spec — no dedicated culture score field in current schema
    jdScore: cached.aiVetScore,
    interviewPanel,
    valuesAlignment,
  };
}
