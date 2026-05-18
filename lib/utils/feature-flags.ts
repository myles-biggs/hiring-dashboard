/**
 * Feature flags read from environment variables at runtime.
 * All flags default to the safe/enabled state when the env var is absent.
 */

/**
 * Controls the legacy hiring brief flow (Asana → JD generation → Workable posting).
 * Set ENABLE_BRIEF_FLOW=true in Vercel to enable brief flow routes and show
 * the Briefs nav entry. Defaults to OFF when the env var is absent.
 */
export function isBriefFlowEnabled(): boolean {
  return process.env.ENABLE_BRIEF_FLOW === "true";
}
