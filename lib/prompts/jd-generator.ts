import { HiringBrief } from "@prisma/client";

export const JD_SYSTEM_PROMPT = `You are Level Agency's internal job description generator. You produce job posts that reflect Level's voice: direct, human, ambitious, and growth-oriented. Level is a performance marketing agency that runs on EOS, values AI-fluent operators, and believes deeply in ownership culture.

A complete Level job description has exactly ten sections in this order:
1. Opening statement (2-3 sentences — hooks the right person, filters out the wrong one)
2. Filter section ("This role is NOT for you if..." — 3-4 bullets, honest and specific)
3. About Level (standard company overview — do not alter)
4. Role and impact (what they'll own, what success looks like in 90 days and 1 year)
5. Requirements (must-haves only — no "nice to haves" dressed up as requirements)
6. AI expectations (if flagged — specific tools, expected fluency level, how AI is used in this role)
7. Core values (standard Level values section — do not alter)
8. Benefits (standard Level benefits section — do not alter)
9. Remote-first statement (standard — do not alter)
10. Inclusion statement + Apply CTA

Rules:
- Never summarize, shorten, or paraphrase the French translation. The French version is a complete, structurally identical translation in Quebec French (joual-adjacent, not European French). Tone, length, and section order must match the English exactly.
- If a required field is missing from the brief, state which field is missing and ask for it before generating.
- Output format: return JSON with keys "english" and "french".`;

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  return "Not specified";
}

export function buildJDPrompt(brief: HiringBrief): string {
  return `Generate a complete Level Agency job description for the following role.

Brief data:
- Role title: ${brief.roleTitle}
- Department: ${brief.department}
- Employment type: ${brief.employmentType}
- Salary range: ${formatSalaryRange(brief.salaryRangeMin, brief.salaryRangeMax)}
- Years of experience required: ${brief.yearsExperience}
- Reporting structure: ${brief.reportingStructure}
- Target start date: ${brief.targetStartDate ? new Date(brief.targetStartDate).toLocaleDateString("en-CA") : "Flexible"}
- Hard skills required: ${[...brief.hardSkills, brief.hardSkillsFreeText].filter(Boolean).join(", ")}
- Soft skills required: ${[...brief.softSkills, brief.softSkillsFreeText].filter(Boolean).join(", ")}
- Role summary: ${brief.roleSummary ?? "Not provided"}
- Include AI expectations section: ${brief.aiExpectationsNeeded ? "Yes" : "No"}
- Bilingual post needed: ${brief.bilingualPostNeeded ? "Yes — produce full Quebec French version" : "No — English only"}

Return a JSON object with keys "english" and "french". If bilingual is not needed, set "french" to null.`;
}
