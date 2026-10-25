import { modelAllowed, modelLabel } from "./expert-mode";
import type { ModelSelection } from "./types";

export const profileKey = (selection: ModelSelection): string =>
  JSON.stringify([selection.provider, selection.synthesis, selection.language]);

// Recommendations stay simple even in Expert Mode. Advanced profiles are chosen in Settings.
export function creatorOptions(recommendations: readonly ModelSelection[], chosen: ModelSelection | undefined, expertMode: boolean) {
  const options = recommendations.map(selection => ({ selection, value: profileKey(selection), label: modelLabel(selection.synthesis, false), disabled: false }));
  if (chosen && !options.some(option => option.value === profileKey(chosen))) {
    options.unshift({ selection: chosen, value: profileKey(chosen), label: `${modelLabel(chosen.synthesis, true)} · ${modelLabel(chosen.language, true)}`, disabled: !modelAllowed(chosen, expertMode, recommendations) });
  }
  return options;
}
