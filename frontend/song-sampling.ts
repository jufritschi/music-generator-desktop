import { effectiveInferenceSteps } from "./generation-limits";

// Legacy requests used the engine defaults when steps were zero/missing or
// temperature was null/missing. Reusing a song must not apply fresh-form defaults.
export function samplingForSong(params: { inference_steps?: number | null; lm_temperature?: number | null; model_selection?: { synthesis: string } }, fallback?: { synthesis: string }) {
  return { inference_steps: effectiveInferenceSteps(params.inference_steps, params.model_selection?.synthesis ?? fallback?.synthesis), lm_temperature: params.lm_temperature ?? 0.85 };
}
