import { authOptions } from "@/lib/auth/config";
import { requireRole, AuthError } from "@/lib/auth/roles";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const RECIPIENTS = [
  "myles.biggs@level.agency",
  "lonn.shulkin@level.agency",
  "bill.buchanan@level.agency",
];

function getGmailAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
  });
}

function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildMimeMessage(to: string[], subject: string, htmlBody: string, from: string): string {
  const toHeader = to.join(", ");
  const msg = [
    `From: ${from}`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    htmlBody,
  ].join("\r\n");
  return msg;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildHtml(data: Record<string, unknown>, fromDate: string, toDate: string): string {
  const summary = data.summary as Record<string, number>;
  const aiStats = data.aiStats as Record<string, number>;
  const interviews = data.interviews as { total: number; events: Array<{ title: string; date: string }> };
  const jobs = data.jobs as Array<{ title: string; department: string; newInPeriod: number; activeCandidates: number }>;
  const tagBreakdown = data.tagBreakdown as Array<{ tag: string; count: number }>;
  const geoBreakdown = data.geoBreakdown as { canada: number; usa: number; other: number };
  const briefsByDepartment = data.briefsByDepartment as Array<{ department: string; count: number }>;

  const tdStyle = 'style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;"';
  const thStyle = 'style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left;font-weight:600;"';

  const jobRows = jobs
    .map(
      (j) =>
        `<tr><td ${tdStyle}>${j.title}</td><td ${tdStyle}>${j.department}</td><td ${tdStyle}>${j.newInPeriod}</td><td ${tdStyle}>${j.activeCandidates}</td></tr>`
    )
    .join("");

  const tagRows = (tagBreakdown as Array<{ tag: string; count: number }>)
    .slice(0, 15)
    .map((t) => `<tr><td ${tdStyle}>${t.tag}</td><td ${tdStyle}>${t.count}</td></tr>`)
    .join("");

  const deptRows = briefsByDepartment
    .map((d) => `<tr><td ${tdStyle}>${d.department}</td><td ${tdStyle}>${d.count}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#111827;max-width:700px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:4px;">Level Hire Activity Report</h1>
  <p style="color:#6b7280;margin-top:0;">${formatDate(fromDate)} &mdash; ${formatDate(toDate)}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">

  <h2 style="font-size:16px;">Summary</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Metric</th><th ${thStyle}>Value</th></tr>
    <tr><td ${tdStyle}>New Applications (period)</td><td ${tdStyle}>${summary.newApplicationsInPeriod}</td></tr>
    <tr><td ${tdStyle}>Total Applications</td><td ${tdStyle}>${summary.totalApplications}</td></tr>
    <tr><td ${tdStyle}>Open Roles</td><td ${tdStyle}>${summary.activeJobs}</td></tr>
    <tr><td ${tdStyle}>Interviews Scheduled</td><td ${tdStyle}>${summary.totalInterviewsScheduled}</td></tr>
    <tr><td ${tdStyle}>Total Briefs</td><td ${tdStyle}>${summary.totalBriefs}</td></tr>
    <tr><td ${tdStyle}>Pending Approvals</td><td ${tdStyle}>${summary.pendingApprovals}</td></tr>
  </table>

  <h2 style="font-size:16px;">Active Roles</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Role</th><th ${thStyle}>Department</th><th ${thStyle}>New (period)</th><th ${thStyle}>Active</th></tr>
    ${jobRows}
  </table>

  <h2 style="font-size:16px;">AI Vetting</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Metric</th><th ${thStyle}>Value</th></tr>
    <tr><td ${tdStyle}>Total Vetted</td><td ${tdStyle}>${aiStats.totalVetted}</td></tr>
    <tr><td ${tdStyle}>Avg Score</td><td ${tdStyle}>${aiStats.avgScore}</td></tr>
    <tr><td ${tdStyle}>Qualified</td><td ${tdStyle}>${aiStats.qualifiedCount}</td></tr>
    <tr><td ${tdStyle}>Unqualified</td><td ${tdStyle}>${aiStats.unqualifiedCount}</td></tr>
    <tr><td ${tdStyle}>Silver Medalists</td><td ${tdStyle}>${aiStats.silverMedalists}</td></tr>
  </table>

  <h2 style="font-size:16px;">Interviews (${interviews.total} total)</h2>
  ${
    interviews.events.length > 0
      ? `<table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Event</th><th ${thStyle}>Date</th></tr>
    ${interviews.events
      .slice(0, 20)
      .map((e) => `<tr><td ${tdStyle}>${e.title}</td><td ${tdStyle}>${formatDate(e.date)}</td></tr>`)
      .join("")}
  </table>`
      : `<p style="color:#6b7280;">No interviews in this period.</p>`
  }

  <h2 style="font-size:16px;">Geographic Breakdown</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Region</th><th ${thStyle}>Candidates</th></tr>
    <tr><td ${tdStyle}>Canada</td><td ${tdStyle}>${geoBreakdown.canada}</td></tr>
    <tr><td ${tdStyle}>United States</td><td ${tdStyle}>${geoBreakdown.usa}</td></tr>
    <tr><td ${tdStyle}>Other</td><td ${tdStyle}>${geoBreakdown.other}</td></tr>
  </table>

  <h2 style="font-size:16px;">Top Tags</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Tag</th><th ${thStyle}>Count</th></tr>
    ${tagRows}
  </table>

  <h2 style="font-size:16px;">Briefs by Department</h2>
  <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
    <tr><th ${thStyle}>Department</th><th ${thStyle}>Briefs</th></tr>
    ${deptRows}
  </table>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p style="font-size:12px;color:#9ca3af;">Generated by Level Hire &mdash; ${new Date().toISOString()}</p>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    requireRole(session, "ADMIN", "TALENT_ACQUISITION");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { from, to } = body as { from?: string; to?: string };

  // Fetch report data internally
  const baseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.get("host")}`;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const reportRes = await fetch(`${baseUrl}/api/reports/hiring?${params.toString()}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });

  if (!reportRes.ok) {
    return NextResponse.json({ ok: false, error: "Failed to fetch report data" }, { status: 502 });
  }

  const reportData = await reportRes.json();
  const period = reportData.period as { from: string; to: string };

  const subject = `Level Hire Report — ${formatDate(period.from)} to ${formatDate(period.to)}`;
  const htmlBody = buildHtml(reportData, period.from, period.to);

  try {
    const auth = getGmailAuth();
    const gmail = google.gmail({ version: "v1", auth });

    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const fromAddress = `Level Hire <${serviceAccountKey.client_email ?? "noreply@level.agency"}>`;

    const rawMime = buildMimeMessage(RECIPIENTS, subject, htmlBody, fromAddress);
    const raw = toBase64Url(rawMime);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Gmail send failed:", msg);
    return NextResponse.json({
      ok: false,
      error: "Gmail not configured for sending — add domain-wide delegation to service account",
    });
  }
}
