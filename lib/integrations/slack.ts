const SLACK_API = "https://slack.com/api";

async function slackPost(method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
}

export async function postBriefApprovalRequest(brief: {
  id: string;
  roleTitle: string;
  department: string;
  hiringManagerEmail: string;
  employmentType: string;
  salaryRangeMin?: number | null;
  salaryRangeMax?: number | null;
  targetStartDate?: Date | null;
}): Promise<void> {
  const channel = process.env.SLACK_HIRING_CHANNEL_ID!;
  const appUrl = process.env.NEXTAUTH_URL ?? "https://level-hiring.vercel.app";
  const briefUrl = `${appUrl}/briefs/${brief.id}`;

  // Build @mention string from comma-separated Slack user IDs
  const approverIds = (process.env.SLACK_APPROVER_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const mentions = approverIds.map((id) => `<@${id}>`).join(" ");

  const salary =
    brief.salaryRangeMin && brief.salaryRangeMax
      ? `$${brief.salaryRangeMin.toLocaleString()} – $${brief.salaryRangeMax.toLocaleString()}`
      : brief.salaryRangeMin
      ? `From $${brief.salaryRangeMin.toLocaleString()}`
      : "Not specified";

  const startDate = brief.targetStartDate
    ? new Date(brief.targetStartDate).toLocaleDateString("en-CA")
    : "Flexible";

  await slackPost("chat.postMessage", {
    channel,
    text: `New hiring brief submitted: ${brief.roleTitle} (${brief.department})`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 New Hiring Brief — Approval Needed",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Role*\n${brief.roleTitle}` },
          { type: "mrkdwn", text: `*Department*\n${brief.department}` },
          { type: "mrkdwn", text: `*Type*\n${brief.employmentType}` },
          { type: "mrkdwn", text: `*Salary*\n${salary}` },
          { type: "mrkdwn", text: `*Target Start*\n${startDate}` },
          { type: "mrkdwn", text: `*Hiring Manager*\n${brief.hiringManagerEmail}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: mentions
            ? `${mentions} — review and approve or reject this brief in Level Hire.`
            : "Review and approve or reject this brief in Level Hire.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review Brief", emoji: true },
            style: "primary",
            url: briefUrl,
          },
        ],
      },
    ],
    unfurl_links: false,
  });
}

export async function postPipelineSummary(text: string, channelId?: string): Promise<void> {
  const channel = channelId ?? process.env.SLACK_HIRING_CHANNEL_ID!;

  await slackPost("chat.postMessage", {
    channel,
    text,
    unfurl_links: false,
  });
}
