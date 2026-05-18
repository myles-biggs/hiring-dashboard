import { HiringBrief } from "@prisma/client";

export const JOB_POST_SYSTEM_PROMPT = `You are Level Agency's internal job post generator. You produce job posts that reflect Level's voice: direct, human, ambitious, and growth-oriented. Level is a performance marketing agency that runs on EOS, values AI-fluent operators, and believes deeply in ownership culture.

A complete Level job post has exactly ten sections in this order:
1. Opening statement (2-3 sentences — hooks the right person, filters out the wrong one)
2. Filter section ("This role is NOT for you if..." — 3-4 bullets, honest and specific)
3. About Level (standard company overview — do not alter)
4. Role and impact (what they'll own, what success looks like in 90 days and 1 year)
5. Requirements (must-haves only — no "nice to haves" dressed up as requirements)
6. AI expectations (specific tools, expected fluency level, how AI is used in this role)
7. Core values (standard Level values section — do not alter)
8. Benefits (standard Level benefits section — do not alter)
9. Remote-first statement (standard — do not alter)
10. Inclusion statement + Apply CTA

Rules:
- Always generate both English and French Canadian versions. The French version is a complete, structurally identical translation in Quebec French (joual-adjacent, not European French). Tone, length, and section order must match the English exactly. Never summarize or shorten the French version.
- Output must be a JSON object with exactly two keys: "english" (string) and "french" (string). Both are required — never set either to null.`;

// Keep old name as alias for any other callers
export const JD_SYSTEM_PROMPT = JOB_POST_SYSTEM_PROMPT;

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return "Not specified";
}

/** Standalone overload — accepts direct inputs, no HiringBrief dependency. */
export interface StandaloneJobPostArgs {
  roleTitle: string;
  roleContext: string;
  compRange?: string;
  location?: string;
  hardSkills?: string[];
  softSkills?: string[];
}

export function buildStandaloneJobPostPrompt(args: StandaloneJobPostArgs): string {
  const lines = [
    `Generate a complete Level Agency job post for the following role. Both English and French Canadian versions are required.`,
    ``,
    `Role details:`,
    `- Role title: ${args.roleTitle}`,
    `- Role context / description: ${args.roleContext}`,
    `- Compensation range: ${args.compRange ?? "Not specified"}`,
    `- Location: ${args.location ?? "Remote – Canada/US"}`,
    `- Hard skills required: ${args.hardSkills?.join(", ") || "Not specified"}`,
    `- Soft skills required: ${args.softSkills?.join(", ") || "Not specified"}`,
    ``,
    `Return a JSON object with keys "english" and "french". Both must be complete, full-length job posts.`,
  ];
  return lines.join("\n");
}

/** Brief-flow overload — kept intact for existing callers in the briefs workflow. */
export function buildJobPostPrompt(brief: HiringBrief): string {
  return `Generate a complete Level Agency job post for the following role. Both English and French Canadian versions are required.

Brief data:
- Role title: ${brief.roleTitle}
- Department: ${brief.department}
- Employment type: ${brief.employmentType}
- Salary range: ${formatSalaryRange(brief.salaryRangeMin, brief.salaryRangeMax)}
- Years of experience required: ${brief.yearsExperience ?? "Not specified"}
- Target start date: ${brief.targetStartDate ? new Date(brief.targetStartDate).toLocaleDateString("en-CA") : "Flexible"}
- Hard skills required: ${brief.hardSkills ?? "Not specified"}
- Soft skills required: ${brief.softSkills ?? "Not specified"}
- Role summary: ${brief.roleSummary ?? "Not provided"}

Return a JSON object with keys "english" and "french". Both must be complete, full-length job posts.`;
}

// Keep old name as alias
export const buildJDPrompt = buildJobPostPrompt;
