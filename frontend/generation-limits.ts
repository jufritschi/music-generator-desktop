export const MAX_INFERENCE_STEPS = 200;
export const LEGACY_INFERENCE_STEPS_LIMIT = 100;

/** Match the pinned engine's legacy defaults and effective diffusion-step limits. */
export function effectiveInferenceSteps(steps?: number | null, synthesis = ""): number {
  if (steps == null || steps === 0 || !Number.isFinite(steps)) return synthesis.includes("turbo") ? 8 : 50;
  return Math.max(1, Math.min(MAX_INFERENCE_STEPS, Math.trunc(steps)));
}
