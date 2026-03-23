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

export async function postPipelineSummary(text: string, channelId?: string): Promise<void> {
  const channel = channelId ?? process.env.SLACK_HIRING_CHANNEL_ID!;

  await slackPost("chat.postMessage", {
    channel,
    text,
    unfurl_links: false,
  });
}
