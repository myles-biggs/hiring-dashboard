import type { RecommendedAction } from "@prisma/client";

export type CultureBucket = "STRONG" | "MODERATE" | "WEAK" | "POOR";

export function cultureBucket(totalScore: number): CultureBucket {
  if (totalScore >= 36) return "STRONG";
  if (totalScore >= 30) return "STRONG";
  if (totalScore >= 24) return "MODERATE";
  if (totalScore >= 16) return "WEAK";
  return "POOR";
}

export function computeRecommendedAction(
  cultureTotalScore: number,
  jdStarRating: number | null
): RecommendedAction {
  const bucket = cultureBucket(cultureTotalScore);

  if (bucket === "STRONG" && (jdStarRating === null || jdStarRating >= 4)) {
    return "STRONG_ADVANCE";
  }
  if (bucket === "STRONG" || bucket === "MODERATE") {
    if (jdStarRating === null || jdStarRating >= 3) return "ADVANCE";
    return "HOLD";
  }
  if (bucket === "WEAK") {
    return "HOLD";
  }
  return "REJECT";
}
