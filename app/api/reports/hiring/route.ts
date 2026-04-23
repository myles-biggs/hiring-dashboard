import { authOptions } from "@/lib/auth/config";
import { getJobs, getCandidatesForJob } from "@/lib/integrations/workable";
import { prisma } from "@/lib/utils/prisma";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const HIRING_CALENDAR_ID =
  process.env.GOOGLE_HIRING_CALENDAR_ID ??
  "c_ed1c45a8be1971c46b26e4db26edb9e7badf1a2747ed5eee08e1d0e934f19d31@group.calendar.google.com";

function getGoogleAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });
}

function classifyCountry(country: string | null | undefined): "canada" | "usa" | "other" {
  if (!country) return "other";
  const c = country.trim().toUpperCase();
  if (c === "CA" || c === "CANADA") return "canada";
  if (c === "US" || c === "USA" || c === "UNITED STATES") return "usa";
  return "other";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 30);

  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam) : now;

  // ── Workable ─────────────────────────────────────────────────────────────────

  const allJobs = await getJobs();
  const activeJobs = allJobs.filter((j) => j.state === "published");

  const tagCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};

  const jobReports = [];
  let totalApplications = 0;
  let newApplicationsInPeriod = 0;

  for (const job of activeJobs) {
    let candidates;
    try {
      candidates = await getCandidatesForJob(job.shortcode);
    } catch (err) {
      console.error(`Failed to fetch candidates for job ${job.shortcode}:`, err);
      continue;
    }

    const active = candidates.filter((c) => !c.disqualified);
    const newInPeriod = candidates.filter((c) => {
      const created = new Date(c.created_at);
      return created >= from && created <= to;
    });

    totalApplications += candidates.length;
    newApplicationsInPeriod += newInPeriod.length;

    // Stage grouping
    const stageMap: Record<string, { count: number; candidates: Array<{ id: string; name: string; profileUrl?: string }> }> = {};
    for (const c of active) {
      const stageName = c.stage?.name ?? "Unknown";
      if (!stageMap[stageName]) stageMap[stageName] = { count: 0, candidates: [] };
      stageMap[stageName].count++;
      stageMap[stageName].candidates.push({ id: c.id, name: c.name, profileUrl: c.profile_url });
    }

    // Tags
    const jobTagCounts: Record<string, number> = {};
    for (const c of active) {
      for (const tag of c.tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        jobTagCounts[tag] = (jobTagCounts[tag] ?? 0) + 1;
      }
    }

    // Geo — intentionally skipped here; populated from CandidateCache below

    const topTags = Object.entries(jobTagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    jobReports.push({
      shortcode: job.shortcode,
      title: job.title,
      department: job.department,
      totalCandidates: candidates.length,
      activeCandidates: active.length,
      newInPeriod: newInPeriod.length,
      stages: Object.entries(stageMap).map(([name, data]) => ({
        name,
        count: data.count,
        candidates: data.candidates,
      })),
      topTags,
    });
  }

  // Tag breakdown (top 50 for the API; page trims to 15)
  const tagBreakdown = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([tag, count]) => ({ tag, count }));

  // Geo breakdown computed after Prisma fetch (see below)

  // ── Google Calendar ───────────────────────────────────────────────────────────

  let interviewTotal = 0;
  const interviewEvents: Array<{ title: string; date: string; attendeeCount: number }> = [];

  try {
    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const eventsRes = await calendar.events.list({
      calendarId: HIRING_CALENDAR_ID,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      maxResults: 250,
    });
    const events = eventsRes.data.items ?? [];
    interviewTotal = events.length;
    for (const ev of events) {
      interviewEvents.push({
        title: ev.summary ?? "(no title)",
        date: ev.start?.dateTime ?? ev.start?.date ?? "",
        attendeeCount: ev.attendees?.length ?? 0,
      });
    }
  } catch (err) {
    console.error("Google Calendar fetch failed — continuing without interview data:", err);
  }

  // ── Prisma ────────────────────────────────────────────────────────────────────

  const [
    totalBriefs,
    pendingBriefs,
    briefsByDeptRaw,
    vettedCandidates,
    evaluationsInRange,
    geoCandidates,
  ] = await Promise.all([
    prisma.hiringBrief.count(),
    prisma.hiringBrief.count({ where: { approvalStatus: "PENDING" } }),
    prisma.hiringBrief.groupBy({ by: ["department"], _count: { _all: true } }),
    prisma.candidateCache.findMany({
      where: { aiVetScore: { not: null } },
      select: { aiVetScore: true, aiVetStatus: true, isSilverMedalist: true },
    }),
    prisma.candidateEvaluation.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
    prisma.candidateCache.findMany({
      select: { country: true },
    }),
  ]);

  const totalVetted = vettedCandidates.length;
  const scoreSum = vettedCandidates.reduce((acc, c) => acc + (c.aiVetScore ?? 0), 0);
  const avgScore = totalVetted > 0 ? Math.round(scoreSum / totalVetted) : 0;
  const qualifiedCount = vettedCandidates.filter(
    (c) => c.aiVetStatus?.toLowerCase() === "qualified"
  ).length;
  const silverMedalists = vettedCandidates.filter((c) => c.isSilverMedalist).length;

  // Geo breakdown — sourced from CandidateCache (populated during AI vetting)
  for (const c of geoCandidates) {
    const country = c.country ?? "Unknown";
    countryCounts[country] = (countryCounts[country] ?? 0) + 1;
  }

  let canada = 0;
  let usa = 0;
  let other = 0;
  for (const [country, count] of Object.entries(countryCounts)) {
    const bucket = classifyCountry(country);
    if (bucket === "canada") canada += count;
    else if (bucket === "usa") usa += count;
    else other += count;
  }
  const byCountry = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => ({ country, count }));

  const briefsByDepartment = briefsByDeptRaw.map((row) => ({
    department: row.department,
    count: row._count._all,
  }));

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalApplications,
      newApplicationsInPeriod,
      activeJobs: activeJobs.length,
      totalInterviewsScheduled: interviewTotal,
      totalBriefs,
      pendingApprovals: pendingBriefs,
    },
    jobs: jobReports,
    tagBreakdown,
    geoBreakdown: { canada, usa, other, byCountry },
    aiStats: {
      totalVetted,
      avgScore,
      qualifiedCount,
      unqualifiedCount: totalVetted - qualifiedCount,
      silverMedalists,
    },
    interviews: {
      total: interviewTotal,
      events: interviewEvents,
    },
    briefsByDepartment,
    evaluationsInPeriod: evaluationsInRange,
  });
}
