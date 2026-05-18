"use server";

import { generateJson } from "@/lib/integrations/gemini";
import { createDraftJob } from "@/lib/integrations/workable";
import {
  JOB_POST_SYSTEM_PROMPT,
  buildStandaloneJobPostPrompt,
  type StandaloneJobPostArgs,
} from "@/lib/prompts/jd-generator";

interface GeneratedJobPost {
  english: string;
  french: string;
}

export async function generateJobPost(
  input: StandaloneJobPostArgs
): Promise<{ english: string; french: string }> {
  const userMessage = buildStandaloneJobPostPrompt(input);
  const result = await generateJson<GeneratedJobPost>(
    JOB_POST_SYSTEM_PROMPT,
    userMessage
  );

  if (!result.english || !result.french) {
    throw new Error("Gemini returned an incomplete job post — missing english or french key.");
  }

  return { english: result.english, french: result.french };
}

export async function pushDraftToWorkable(payload: {
  title: string;
  description: string;
  descriptionFrench: string;
  department?: string;
}): Promise<{ draftUrl: string }> {
  const { shortcode } = await createDraftJob({
    title: payload.title,
    department: payload.department ?? "General",
    description: payload.description,
    employmentType: "Full-time",
  });

  const subdomain = process.env.WORKABLE_SUBDOMAIN;
  const draftUrl = `https://${subdomain}.workable.com/backend/jobs/${shortcode}`;

  return { draftUrl };
}
