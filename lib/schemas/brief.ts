import { z } from "zod";

export const HARD_SKILLS = [
  "google_ads",
  "programmatic_media",
  "meta_ads",
  "seo_content",
  "ai_tool_proficiency",
  "data_analysis",
  "client_communication",
  "public_speaking",
] as const;

export const HARD_SKILL_LABELS: Record<(typeof HARD_SKILLS)[number], string> = {
  google_ads: "Google Ads",
  programmatic_media: "Programmatic media",
  meta_ads: "Meta Ads",
  seo_content: "SEO / content",
  ai_tool_proficiency: "AI tool proficiency",
  data_analysis: "Data analysis",
  client_communication: "Client communication",
  public_speaking: "Public speaking",
};

export const SOFT_SKILLS = [
  "ownership_mindset",
  "comfort_with_ambiguity",
  "systems_thinking",
  "collaboration",
  "proactive_communication",
] as const;

export const SOFT_SKILL_LABELS: Record<(typeof SOFT_SKILLS)[number], string> = {
  ownership_mindset: "Ownership mindset",
  comfort_with_ambiguity: "Comfort with ambiguity",
  systems_thinking: "Systems thinking",
  collaboration: "Collaboration",
  proactive_communication: "Proactive communication",
};

export const DEPARTMENTS = [
  "Paid Search",
  "Paid Social",
  "SEO",
  "Programmatic",
  "Analytics",
  "Client Strategy",
  "People Ops",
  "Finance",
  "Tech Enablement",
  "Leadership",
] as const;

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
] as const;

export const briefSchema = z.object({
  roleTitle: z.string().min(2, "Role title is required"),
  department: z.string().min(1, "Department is required"),
  hiringManagerEmail: z.string().email("Valid hiring manager email required"),
  employmentType: z.string().min(1, "Employment type is required"),
  salaryRangeMin: z.number().int().positive().optional(),
  salaryRangeMax: z.number().int().positive().optional(),
  yearsExperience: z.string().min(1, "Years of experience is required"),
  reportingStructure: z.string().min(2, "Reporting structure is required"),
  targetStartDate: z.string().optional(),
  roleSummary: z.string().optional(),
  jdUploadUrl: z.string().url().optional().or(z.literal("")),
  aiExpectationsNeeded: z.boolean().default(false),
  bilingualPostNeeded: z.boolean().default(false),
  hardSkills: z.array(z.string()).default([]),
  hardSkillsFreeText: z.string().optional(),
  softSkills: z.array(z.string()).default([]),
  softSkillsFreeText: z.string().optional(),
});

export type BriefFormValues = z.infer<typeof briefSchema>;
