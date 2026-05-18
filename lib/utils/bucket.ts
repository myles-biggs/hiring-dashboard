import type { DispositionAction } from "@/lib/schemas/disposition";

export type ScoreBucket = "PASS" | "POSSIBLE" | "STRONG";

export function jobPostingBucket(score: number): ScoreBucket {
  if (score >= 80) return "STRONG";
  if (score >= 60) return "POSSIBLE";
  return "PASS";
}

export function recommendedAction(args: {
  jdBucket: ScoreBucket;
  cultureBucket: ScoreBucket | null;
}): DispositionAction {
  const { jdBucket, cultureBucket } = args;

  if (jdBucket === "PASS") return "DISQUALIFY";

  if (cultureBucket === null) {
    return jdBucket === "STRONG" ? "ADVANCE" : "HOLD";
  }

  if (cultureBucket === "PASS") return "DISQUALIFY";
  if (jdBucket === "STRONG" && cultureBucket === "STRONG") return "ADVANCE";
  return "HOLD";
}
