import { z } from "zod";

// Workable webhook candidate_created payload shape
export const workableCandidateWebhookSchema = z.object({
  event_type: z.literal("candidate_created"),
  data: z.object({
    candidate: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email().optional(),
      resume_url: z.string().url().optional(),
      linkedin_profile_url: z.string().url().optional(),
      cover_letter: z.string().optional(),
      application_answers: z.array(z.unknown()).optional(),
      source: z
        .object({
          type: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
    }),
    job: z.object({
      shortcode: z.string(),
      title: z.string(),
    }),
  }),
});

export type WorkableCandidateWebhook = z.infer<
  typeof workableCandidateWebhookSchema
>;

// Candidate upsert input
export const candidateUpsertSchema = z.object({
  workableCandidateId: z.string().min(1),
  workableJobShortcode: z.string().min(1),
  workableJobTitle: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  resumeUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  coverLetter: z.string().optional(),
  applicationAnswers: z.unknown().optional(),
  applicationSource: z.string().optional(),
});

export type CandidateUpsertInput = z.infer<typeof candidateUpsertSchema>;
