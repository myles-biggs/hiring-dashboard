import type { Candidate } from "@prisma/client";

export const VETTING_PROMPT_VERSION = "1.0.0";

export function buildVettingPrompt(args: {
  candidate: Candidate;
  jobTitle: string;
  jobDescription?: string;
  hardSkills?: string[];
  softSkills?: string[];
}): { system: string; user: string } {
  const { candidate, jobTitle, jobDescription, hardSkills, softSkills } = args;

  const system = `You are a senior recruiter evaluating candidates against a specific job posting.

Your task is to assess fit between the candidate's profile and the role requirements.

Score range: 0–100
- 0–59: PASS (not a fit at this time)
- 60–79: POSSIBLE (potential fit, warrants a closer look)
- 80–100: STRONG (clear fit, recommend advancing)

Output requirements:
- Respond with valid JSON only. No markdown. No prose outside the JSON object.
- JSON structure: { "score": number, "rationale": string }
- rationale: 3–5 sentences explaining the bucket. Be specific about what evidence drove the score.

Important rules:
- Missing resume data, cover letter, or application answers are not penalized. Score on what is present.
- Do not consider or infer protected characteristics. Do not use name as a proxy for national origin or ethnicity. Do not infer age from graduation years. Evaluate skills and experience only.
- If job description is not provided, evaluate against the job title alone.`;

  const lines: string[] = [
    `Job title: ${jobTitle}`,
    jobDescription ? `Job description:\n${jobDescription}` : "",
    hardSkills?.length ? `Required hard skills: ${hardSkills.join(", ")}` : "",
    softSkills?.length ? `Required soft skills: ${softSkills.join(", ")}` : "",
    "",
    `Candidate name: ${candidate.name}`,
    `Current stage: ${candidate.currentStage}`,
    candidate.coverLetter ? `Cover letter:\n${candidate.coverLetter}` : "Cover letter: Not provided",
    candidate.applicationAnswers
      ? `Application answers:\n${JSON.stringify(candidate.applicationAnswers, null, 2)}`
      : "Application answers: Not provided",
    candidate.linkedinUrl ? `LinkedIn: ${candidate.linkedinUrl}` : "",
    candidate.tags?.length ? `Tags: ${candidate.tags.join(", ")}` : "",
    candidate.source ? `Source: ${candidate.source}` : "",
  ];

  const user = lines.filter(Boolean).join("\n");

  return { system, user };
}
