import { z } from "zod";

export const workableCandidateWebhookSchema = z.object({
  event_type: z.string(),
  data: z.object({
    candidate: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        headline: z.string().optional(),
        stage: z.union([
          z.object({ name: z.string(), kind: z.string(), position: z.number() }),
          z.string(),
        ]),
        disqualified: z.boolean().optional(),
        job: z.object({
          id: z.string(),
          title: z.string(),
          shortcode: z.string(),
          url: z.string(),
        }),
        created_at: z.string(),
        resume_url: z.string().optional(),
        linkedin_url: z.string().optional(),
        cover_letter: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source: z
          .object({ id: z.string().optional(), name: z.string().optional() })
          .optional(),
        answers: z
          .array(z.object({ question: z.string(), answer: z.string().optional() }))
          .optional(),
      })
      .optional(),
    job: z.unknown().optional(),
  }),
});

export type WorkableCandidateWebhookPayload = z.infer<typeof workableCandidateWebhookSchema>;
