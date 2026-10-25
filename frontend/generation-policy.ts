import "./cpu-i18n";
import { backend } from "./backend";
import { DEFAULT_FORM_PREFERENCES } from "./form-preferences";
import { t } from "./i18n.js";
import { samplingForSong } from "./song-sampling";
import type { Generation, GenerationPolicy, ModelSelection } from "./types";

let policy: GenerationPolicy = { backend: "unknown", recommended_steps: 30, defaults: { ...DEFAULT_FORM_PREFERENCES } };
let policyRevision = 0;
export async function loadGenerationPolicy(selection?: ModelSelection, refresh = false): Promise<GenerationPolicy> {
  const revision = ++policyRevision;
  let result: GenerationPolicy;
  try { result = await backend.generationPolicy(selection, refresh); }
  catch { result = { backend: "unknown", recommended_steps: 30, defaults: { ...DEFAULT_FORM_PREFERENCES } }; }
  if (revision === policyRevision) { policy = result; updateCpuWarnings(); }
  return result;
}
export const warningKey = (backend: GenerationPolicy["backend"]) => backend === "cpu" ? "cpu_warning" : "cpu_unknown_warning";
export function needsCpuConfirmation(backend: GenerationPolicy["backend"], steps: number): boolean { return backend !== "gpu" && steps > 30; }
export function updateCpuWarnings(): void {
  const input = document.querySelector<HTMLInputElement>('#genForm [name="inference_steps"]');
  const visible = needsCpuConfirmation(policy.backend, Number(input?.value));
  for (const id of ["cpuIterationWarning", "cpuGenerationWarning"]) {
    const node = document.getElementById(id);
    if (node) { node.hidden = !visible; node.textContent = t(warningKey(policy.backend)); }
  }
}

export type CpuChoice = "reduce" | "continue" | null;
export function askCpuConfirmation(device: GenerationPolicy["backend"]): Promise<CpuChoice> {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog"); dialog.className = "cpu-dialog";
    dialog.setAttribute("aria-labelledby", "cpuDialogTitle"); dialog.setAttribute("aria-describedby", "cpuDialogText");
    const heading = document.createElement("h2"); heading.id = "cpuDialogTitle";
    const text = document.createElement("p"); text.id = "cpuDialogText";
    const form = document.createElement("form"); form.method = "dialog"; form.className = "submit";
    const buttons = ["reduce", "continue", "cancel"].map(value => {
      const button = document.createElement("button"); button.value = value;
      button.className = value === "reduce" ? "aktion" : "sek"; form.append(button); return button;
    });
    const translate = () => {
      heading.textContent = t("cpu_title"); text.textContent = t(warningKey(device));
      buttons.forEach((button, i) => { button.textContent = t(["cpu_reduce", "cpu_continue", "cancel"][i]); });
    };
    translate(); document.addEventListener("langchange", translate);
    dialog.append(heading, text, form); document.body.append(dialog);
    dialog.addEventListener("close", () => {
      document.removeEventListener("langchange", translate);
      resolve(dialog.returnValue === "reduce" || dialog.returnValue === "continue" ? dialog.returnValue : null); dialog.remove();
    }, { once: true });
    dialog.showModal(); buttons[0].focus();
  });
}

// One gate covers clicks, keyboard submission and retry throughout probe + dialog + admission.
export function createGenerationGate(deps = { policy: loadGenerationPolicy, ask: askCpuConfirmation, generate: backend.generate, retry: backend.retry }) {
  let busy = false;
  return async (values: Generation, retryId?: string, applyReduced?: () => void): Promise<{ ids: string[] } | null> => {
    if (busy) return null;
    busy = true;
    try {
      const request = structuredClone(values);
      const current = await deps.policy(request.model_selection, true);
      const steps = samplingForSong(request).inference_steps;
      let reduced = false;
      if (needsCpuConfirmation(current.backend, steps)) {
        const choice = await deps.ask(current.backend);
        if (!choice) return null;
        if (choice === "reduce") { request.inference_steps = 30; reduced = true; if (!retryId) applyReduced?.(); }
      }
      if (retryId && !reduced) { const song = await deps.retry(retryId); return { ids: [song.id] }; }
      if (retryId) { request.variants = 1; delete request.group_id; }
      return await deps.generate(request);
    } finally { busy = false; }
  };
}
export const startGeneration = createGenerationGate();
