import { z } from "zod";

export const dimensionScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  evidence: z.array(z.string()).min(1).max(2),
});

export const cultureFitOutputSchema = z.object({
  dimensionScores: z.object({
    getsIt: dimensionScoreSchema,
    wantsIt: dimensionScoreSchema,
    capacityToDoIt: dimensionScoreSchema,
    noEgoAllIn: dimensionScoreSchema,
    betterEveryDay: dimensionScoreSchema,
    relentlessForResults: dimensionScoreSchema,
    drivenByTruth: dimensionScoreSchema,
    aiForward: dimensionScoreSchema,
  }),
  totalScore: z.number().int().min(8).max(40),
  starRating: z.number().int().min(1).max(5),
  summary: z.string(),
});

export type CultureFitOutput = z.infer<typeof cultureFitOutputSchema>;
export type DimensionScores = CultureFitOutput["dimensionScores"];
