/**
 * Feature flags read from environment variables at runtime.
 * All flags default to the safe/enabled state when the env var is absent.
 */

/**
 * Controls the legacy hiring brief flow (Asana → JD generation → Workable posting).
 * Set ENABLE_BRIEF_FLOW=false in Vercel to disable all brief flow routes and hide
 * the Briefs nav entry. Code is preserved; only runtime access is gated.
 */
export function isBriefFlowEnabled(): boolean {
  return process.env.ENABLE_BRIEF_FLOW !== "false";
}
