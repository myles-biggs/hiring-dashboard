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

// Disposition action matrix — source of truth: .specify/specs/hiring-app-spec.md
export function recommendedAction(args: {
  jdBucket: JdBucket;
  cultureBucket: CultureBucket | null;
}): { action: DispositionAction; reason: string } {
  const { jdBucket, cultureBucket: cb } = args;

  if (jdBucket === "PASS") {
    return {
      action: "DISQUALIFY",
      reason: "Insufficient role fit. Disqualify for this role, retain in database.",
    };
  }

  if (jdBucket === "STRONG") {
    if (cb === "STRONG") {
      return { action: "ADVANCE", reason: "High alignment on role + culture. Move to offer track." };
    }
    if (cb === "POSSIBLE") {
      return { action: "PANEL_REVIEW", reason: "Strong role fit, culture mixed. Bring panel for tiebreak." };
    }
    if (cb === "WEAK") {
      return { action: "SECOND_OPINION", reason: "Strong role fit but culture concerns. Second TA review before reject." };
    }
    // cb === null
    return { action: "SCHEDULE_INTERVIEW", reason: "Strong role fit, no culture data yet. Schedule first interview." };
  }

  // jdBucket === "POSSIBLE"
  if (cb === "STRONG") {
    return { action: "ADVANCE", reason: "Strong culture compensates for partial role fit. TA review." };
  }
  if (cb === "POSSIBLE") {
    return { action: "HOLD", reason: "Mixed on both axes. Hold for future role match." };
  }
  if (cb === "WEAK") {
    return { action: "DISQUALIFY", reason: "Partial role fit, culture concerns. Disqualify for this role." };
  }
  // cb === null
  return { action: "SCHEDULE_INTERVIEW", reason: "Partial role fit. Worth a screen to gather culture signal." };
}
