import type { DispositionAction } from "@/lib/schemas/disposition";

export const JD_STRONG_THRESHOLD = 80;
export const JD_POSSIBLE_THRESHOLD = 60;
export const CULTURE_STRONG_THRESHOLD = 30;
export const CULTURE_POSSIBLE_THRESHOLD = 24;

export type JdBucket = "STRONG" | "POSSIBLE" | "PASS";
export type CultureBucket = "STRONG" | "POSSIBLE" | "WEAK";

export function jobPostingBucket(score: number): JdBucket {
  if (score >= JD_STRONG_THRESHOLD) return "STRONG";
  if (score >= JD_POSSIBLE_THRESHOLD) return "POSSIBLE";
  return "PASS";
}

export function cultureBucket(score: number): CultureBucket {
  if (score >= CULTURE_STRONG_THRESHOLD) return "STRONG";
  if (score >= CULTURE_POSSIBLE_THRESHOLD) return "POSSIBLE";
  return "WEAK";
}

// TODO: verify full matrix against spec
export function recommendedAction(args: {
  jdBucket: JdBucket;
  cultureBucket: CultureBucket | null;
}): { action: DispositionAction; reason: string } {
  const { jdBucket, cultureBucket: cb } = args;

  if (jdBucket === "PASS") {
    return {
      action: "DISQUALIFY",
      reason: "Candidate does not meet job posting fit threshold.",
    };
  }

  if (jdBucket === "STRONG") {
    if (cb === "STRONG") {
      return { action: "ADVANCE", reason: "Strong fit on both job posting and culture dimensions." };
    }
    if (cb === "POSSIBLE") {
      return { action: "SCHEDULE_INTERVIEW", reason: "Strong job fit with moderate culture alignment; schedule interview to assess further." };
    }
    if (cb === "WEAK") {
      return { action: "PANEL_REVIEW", reason: "Strong job fit but weak culture signal; escalate to panel review." };
    }
    // cb === null
    return { action: "SCHEDULE_INTERVIEW", reason: "Strong job fit; no culture data available — schedule interview." };
  }

  // jdBucket === "POSSIBLE"
  if (cb === "STRONG") {
    return { action: "SCHEDULE_INTERVIEW", reason: "Strong culture fit with possible job fit; schedule interview to assess role alignment." };
  }
  if (cb === "POSSIBLE") {
    return { action: "SECOND_OPINION", reason: "Moderate fit on both dimensions; request second opinion before advancing." };
  }
  if (cb === "WEAK") {
    return { action: "HOLD", reason: "Possible job fit but weak culture alignment; hold for later review." };
  }
  // cb === null
  return { action: "SECOND_OPINION", reason: "Possible job fit with no culture data; request second opinion." };
}
