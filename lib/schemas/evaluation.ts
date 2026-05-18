import { z } from "zod";

export const jobPostingFitOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string(),
});

export type JobPostingFitOutput = z.infer<typeof jobPostingFitOutputSchema>;
