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

async function slackGet<T>(method: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SLACK_API}/${method}?${qs}`, {
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
  });

  const data = (await res.json()) as T & { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
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
          text: "New Hiring Brief — Approval Needed",
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

export async function postStarCandidateAlert(params: {
  candidateName: string;
  roleTitle: string;
  score: number;
  shortcode: string;
}): Promise<void> {
  const channelId = process.env.SLACK_HIRING_CHANNEL_ID;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!channelId || !token) return;

  const url = `https://level-hiring.vercel.app/postings/${params.shortcode}`;

  await slackPost("chat.postMessage", {
    channel: channelId,
    text: `Star Candidate: ${params.candidateName} for ${params.roleTitle} — AI Score: ${params.score}/100`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Star Candidate Alert*\n*${params.candidateName}* applied for *${params.roleTitle}*\nAI Score: *${params.score}/100*\n<${url}|View pipeline →>`,
        },
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

// ── Reports integration ────────────────────────────────────────────────────────

export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  files?: { name: string; url: string }[];
}

interface ConversationsHistoryResponse {
  ok: boolean;
  error?: string;
  messages: Array<{
    ts: string;
    text: string;
    user: string;
    files?: Array<{ name: string; url_private: string }>;
  }>;
}

export async function readChannelMessages(
  channelId: string,
  since?: Date
): Promise<SlackMessage[]> {
  const params: Record<string, string> = { channel: channelId, limit: "200" };
  if (since) params.oldest = String(since.getTime() / 1000);

  const data = await slackGet<ConversationsHistoryResponse>(
    "conversations.history",
    params
  );

  return (data.messages ?? []).map((m) => ({
    ts: m.ts,
    text: m.text,
    user: m.user,
    files: m.files?.map((f) => ({ name: f.name, url: f.url_private })),
  }));
}

interface ConversationsListResponse {
  ok: boolean;
  error?: string;
  channels: Array<{ id: string; name: string }>;
}

export async function searchChannels(
  namePrefix: string
): Promise<{ id: string; name: string }[]> {
  const data = await slackGet<ConversationsListResponse>("conversations.list", {
    exclude_archived: "true",
    limit: "200",
  });

  return (data.channels ?? [])
    .filter((c) => c.name.startsWith(namePrefix))
    .map((c) => ({ id: c.id, name: c.name }));
}

export async function postMessage(
  channelId: string,
  text: string
): Promise<{ ts: string; channel: string }> {
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: channelId, text, unfurl_links: false }),
  });

  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    ts: string;
    channel: string;
  };
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return { ts: data.ts, channel: data.channel };
}

export async function getMessagePermalink(
  channelId: string,
  ts: string
): Promise<string> {
  const data = await slackGet<{ ok: boolean; error?: string; permalink: string }>(
    "chat.getPermalink",
    { channel: channelId, message_ts: ts }
  );
  return data.permalink;
}
