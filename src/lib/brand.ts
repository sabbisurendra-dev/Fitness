export const APP_NAME = "My Fitness";
export const APP_HUB_NAME = "Fitness Hub";
export const APP_LOG_NAME = "Fitness Log";
export const APP_TITLE = "My Fitness — Daily Training, Nutrition & Recovery Hub";
export const APP_DESCRIPTION =
  "Private, zero-signup Fitness Hub for gym workouts, Indian & global nutrition tracking, and sleep recovery sufficiency.";
export const EXPORT_FILE_PREFIX = "fitness-log";

export const AI_TIER_LABELS: Record<string, string> = {
  "gemini-4-hydrogen": "Fast",
  "gemini-4-argon": "Deep",
  "gemini-4-carbon": "Deep",
};

/** Maps internal AI model identifiers to user-facing speed/depth labels. */
export function getAiTierLabel(model?: string): string {
  if (!model) return "Fast";
  return AI_TIER_LABELS[model] || (model.includes("argon") || model.includes("carbon") ? "Deep" : "Fast");
}
