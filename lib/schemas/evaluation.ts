import { z } from "zod";

const evaluationSourceSchema = z.enum([
  "RESUME",
  "COVER_LETTER",
  "APPLICATION_ANSWERS",
  "LINKEDIN_URL",
  "TRANSCRIPT",
]);

export const jobPostingFitOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  bucket: z.enum(["STRONG", "POSSIBLE", "PASS"]).optional(),
  rationale: z.string().min(1),
  sources: z.array(evaluationSourceSchema).optional(),
});

export type JobPostingFitOutput = z.infer<typeof jobPostingFitOutputSchema>;

export const cultureFitOutputSchema = z.object({
  totalScore: z.number().int().min(8).max(40),
  starRating: z.number().int().min(1).max(5),
  bucket: z.enum(["STRONG", "POSSIBLE", "WEAK"]),
  rationale: z.string().min(1),
  dimensionScores: z.record(z.string(), z.number()),
  dimensionEvidence: z.record(z.string(), z.array(z.string())),
});

export type CultureFitOutput = z.infer<typeof cultureFitOutputSchema>;
