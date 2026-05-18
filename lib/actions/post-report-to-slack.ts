"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { postMessage, getMessagePermalink } from "@/lib/integrations/slack";

const REPORTS_CHANNEL_ID = "C0B2R77KRB3";

export async function postReportToSlack(
  reportType: "state-of-hiring" | "daily-snapshot" | "pipeline",
  preview: string
): Promise<{ messagePermalink: string }> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const { ts, channel } = await postMessage(REPORTS_CHANNEL_ID, preview);
  const permalink = await getMessagePermalink(channel, ts);

  return { messagePermalink: permalink };
}
