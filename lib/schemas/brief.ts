import { z } from "zod"

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
] as const

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Freelance"] as const

export const briefSchema = z.object({
  roleTitle: z.string().min(2, "Role title is required"),
  department: z.string().min(1, "Department is required"),
  hiringManagerEmail: z.string().email("Valid hiring manager email required"),
  employmentType: z.string().min(1, "Employment type is required"),
  salaryRangeMin: z.number().int().positive().optional(),
  salaryRangeMax: z.number().int().positive().optional(),
  yearsExperience: z.number().int().positive().optional(),
  targetStartDate: z.string().optional(),
  roleSummary: z.string().optional(),
  hardSkills: z.string().optional(),
  softSkills: z.string().optional(),
})

export type BriefFormValues = z.infer<typeof briefSchema>
