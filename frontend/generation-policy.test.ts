// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import { askCpuConfirmation, createGenerationGate, loadGenerationPolicy, needsCpuConfirmation, needsCpuWarning, updateCpuWarnings, updateObservedSynthesis } from "./generation-policy";
import { backend } from "./backend";
import { DEFAULT_FORM_PREFERENCES } from "./form-preferences";
import { I18N, setLang } from "./i18n.js";
import { LANGS } from "./locales";
import { cpuTranslations, cpuBehaviorKeys, cpuBehaviorTranslations } from "./cpu-i18n";
import type { BackendStatus, ComponentBackend, Generation, GenerationPolicy } from "./types";
const policy = (device: GenerationPolicy["backend"]): GenerationPolicy => ({ backend: device, cpu_iteration_behavior: "ask", recommended_steps: device === "gpu" ? 80 : 30, defaults: { ...DEFAULT_FORM_PREFERENCES } });
const request: Generation = { prompt: "piano", inference_steps: 80, duration: 10, seed: 42, variants: 2, group_id: "old-group" };
const deps = () => ({ policy: vi.fn().mockResolvedValue(policy("cpu")), ask: vi.fn().mockResolvedValue("continue"), generate: vi.fn().mockResolvedValue({ ids: ["new"] }), retry: vi.fn().mockResolvedValue({ id: "old" }) });
beforeEach(() => { mountStudio(); setLang("de"); updateObservedSynthesis(undefined); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([["cpu", 30, false], ["cpu", 31, true], ["gpu", 200, false], ["unknown", 31, true]] as const)("checks %s at %s steps", (backend, steps, expected) => {
  expect(needsCpuConfirmation(backend, steps)).toBe(expected);
});
it("reduces and persists the form through its callback only after confirmation", async () => {
  const d = deps(); d.ask.mockResolvedValue("reduce"); const changed = vi.fn();
  await createGenerationGate(d)(request, undefined, changed);
  expect(changed).toHaveBeenCalledOnce();
  expect(d.generate).toHaveBeenCalledWith({ ...request, inference_steps: 30 });
  expect(request.inference_steps).toBe(80);
});
it("keeps high steps only for the explicitly confirmed submission", async () => {
  const d = deps(), gate = createGenerationGate(d);
  await gate(request); await gate(request);
  expect(d.ask).toHaveBeenCalledTimes(2);
  expect(d.generate).toHaveBeenCalledWith(request);
  expect(d.policy).toHaveBeenCalledWith(undefined, true);
});
it("does not enqueue cancelled work and releases the gate", async () => {
  const d = deps(); d.ask.mockResolvedValueOnce(null);
  const gate = createGenerationGate(d); expect(await gate(request)).toBeNull();
  expect(d.generate).not.toHaveBeenCalled(); await gate(request); expect(d.generate).toHaveBeenCalledOnce();
});
it("blocks duplicate submissions and freezes the request while awaiting the probe", async () => {
  const d = deps(); let finish!: (p: GenerationPolicy) => void;
  d.policy.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const values = { ...request }; const gate = createGenerationGate(d); const pending = gate(values);
  values.duration = 600;
  expect(await gate(request, "old")).toBeNull();
  finish(policy("cpu")); await pending;
  expect(d.generate).toHaveBeenCalledOnce(); expect(d.generate.mock.lastCall![0].duration).toBe(10);
});
it("rechecks devices on every submission and does not warn for GPU synthesis with a CPU language model", async () => {
  const d = deps(); d.policy.mockResolvedValueOnce(policy("gpu")).mockResolvedValueOnce(policy("cpu"));
  const gate = createGenerationGate(d); await gate(request); expect(d.ask).not.toHaveBeenCalled();
  await gate(request); expect(d.ask).toHaveBeenCalledOnce();
});
it("warns for an unknown device and for legacy automatic SFT steps", async () => {
  const d = deps(); d.policy.mockResolvedValue(policy("unknown"));
  await createGenerationGate(d)({ ...request, inference_steps: 0 }); expect(d.ask).toHaveBeenCalledWith("unknown");
});
it("retries unchanged snapshots or creates one reduced copy without editing the original", async () => {
  const d = deps(); const gate = createGenerationGate(d), changed = vi.fn();
  await gate(request, "old", changed); expect(d.retry).toHaveBeenCalledWith("old"); expect(d.generate).not.toHaveBeenCalled();
  d.ask.mockResolvedValue("reduce"); await gate(request, "old", changed);
  expect(d.generate).toHaveBeenCalledWith({ ...request, inference_steps: 30, variants: 1, group_id: undefined });
  expect(changed).not.toHaveBeenCalled(); expect(request.inference_steps).toBe(80);
});
it("shows translated warnings outside collapsed advanced settings after policy failure", async () => {
  await loadGenerationPolicy();
  const input = document.querySelector<HTMLInputElement>('[name="inference_steps"]')!; input.value = "31"; updateCpuWarnings();
  const warning = document.getElementById("cpuGenerationWarning")!;
  expect(document.querySelectorAll("#genForm .cpu-warning")).toHaveLength(1);
  expect(warning.hidden).toBe(false); expect(document.getElementById("advBox")!.contains(warning)).toBe(false);
  expect(warning.textContent).toBe(cpuTranslations.de[1]);
  setLang("en"); updateCpuWarnings(); expect(warning.textContent).toBe(cpuTranslations.en[1]);
  input.value = "30"; updateCpuWarnings(); expect(warning.hidden).toBe(false);
  expect(input.closest(".slider")!.classList.contains("cpu-risk")).toBe(true);
  expect(input.getAttribute("aria-describedby")).toBe("cpuGenerationWarning");
  input.value = "29"; updateCpuWarnings(); expect(warning.hidden).toBe(true);
  expect(input.closest(".slider")!.classList.contains("cpu-risk")).toBe(false);
  expect(input.hasAttribute("aria-describedby")).toBe(false);
});
it("offers three localized dialog actions, focuses the recommendation, translates live and cancels on Escape", async () => {
  const show = vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function(this: HTMLDialogElement) { this.open = true; });
  const pending = askCpuConfirmation("cpu"), dialog = document.querySelector<HTMLDialogElement>(".cpu-dialog")!;
  expect(dialog.getAttribute("aria-describedby")).toBe("cpuDialogText");
  expect(dialog.querySelectorAll("button")).toHaveLength(3); expect(document.activeElement).toBe(dialog.querySelector("button"));
  setLang("en"); expect(dialog.querySelector("button")!.textContent).toBe(cpuTranslations.en[4]);
  dialog.returnValue = ""; dialog.dispatchEvent(new Event("close")); expect(await pending).toBeNull();
  expect(document.querySelector(".cpu-dialog")).toBeNull(); show.mockRestore();
});
it.each(["reduce", "continue"] as const)("returns the %s dialog action", async choice => {
  const show = vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(() => {});
  const pending = askCpuConfirmation("unknown"), dialog = document.querySelector<HTMLDialogElement>(".cpu-dialog")!;
  dialog.returnValue = choice; dialog.dispatchEvent(new Event("close")); expect(await pending).toBe(choice); show.mockRestore();
});
it("provides complete CPU texts and updated iteration help for all twelve UI languages", () => {
  expect(Object.keys(cpuTranslations).sort()).toEqual(Object.keys(LANGS).sort());
  for (const [language, values] of Object.entries(cpuTranslations)) {
    expect(values).toHaveLength(8); expect(values.every(v => v.trim().length > 0)).toBe(true);
    expect((I18N as unknown as Record<string, Record<string, string>>)[language].iterations_tip).toContain("30");
  }
});

it.each(["cpu", "unknown", "gpu"] as const)("marks the exact 29/30/31 visual boundary on %s", backend => {
  expect(needsCpuWarning(backend, 29)).toBe(false);
  expect(needsCpuWarning(backend, 30)).toBe(backend !== "gpu");
  expect(needsCpuWarning(backend, 31)).toBe(backend !== "gpu");
  expect(needsCpuConfirmation(backend, 30)).toBe(false);
});

it.each(["cpu", "unknown"] as const)("applies both remembered answers on %s without asking again", async backend => {
  const d = deps(); const changed = vi.fn(), gate = createGenerationGate(d);
  d.policy.mockResolvedValue({ ...policy(backend), cpu_iteration_behavior: "limit_30" });
  await gate(request, undefined, changed);
  expect(d.ask).not.toHaveBeenCalled(); expect(changed).toHaveBeenCalledOnce();
  expect(d.generate).toHaveBeenLastCalledWith({ ...request, inference_steps: 30 });
  await gate({ ...request, inference_steps: 8 });
  expect(d.generate).toHaveBeenLastCalledWith({ ...request, inference_steps: 8 });
  await gate(request, "old");
  expect(d.generate).toHaveBeenLastCalledWith({ ...request, group_id: undefined, variants: 1, inference_steps: 30 });
  d.policy.mockResolvedValue({ ...policy(backend), cpu_iteration_behavior: "continue" });
  await gate(request); expect(d.generate).toHaveBeenLastCalledWith(request);
  await gate(request, "old"); expect(d.retry).toHaveBeenLastCalledWith("old");
  d.policy.mockResolvedValue(policy(backend)); await gate(request); expect(d.ask).toHaveBeenCalledOnce();
});

it("does not apply remembered CPU caps to GPU synthesis", async () => {
  const d = deps(); d.policy.mockResolvedValue({ ...policy("gpu"), cpu_iteration_behavior: "limit_30" });
  await createGenerationGate(d)(request);
  expect(d.generate).toHaveBeenCalledWith(request); expect(d.ask).not.toHaveBeenCalled();
});

it("sends an effective 100-step GPU request instead of a historical 120 without a CPU warning", async () => {
  const d = deps(); d.policy.mockResolvedValue(policy("gpu"));
  const legacy = Object.freeze({ ...request, inference_steps: 120 });
  await createGenerationGate(d)(legacy);
  expect(d.generate).toHaveBeenCalledWith({ ...legacy, inference_steps: 100 });
  expect(d.ask).not.toHaveBeenCalled(); expect(legacy.inference_steps).toBe(120);
});

it.each([["acestep-v15-sft-Q8_0.gguf", 50], ["acestep-v15-turbo-Q8_0.gguf", 8]] as const)("preserves legacy automatic engine sampling for %s when making a new request", async (synthesis, steps) => {
  const d = deps(); d.policy.mockResolvedValue(policy("gpu"));
  const legacy = { ...request, inference_steps: 0, ...(synthesis ? { model_selection: { provider: "ace-step", synthesis, language: "lm" } } : {}) };
  await createGenerationGate(d)(legacy);
  expect(d.generate).toHaveBeenCalledWith({ ...legacy, inference_steps: steps });
  expect(legacy.inference_steps).toBe(0);
});

it("leaves legacy automatic steps to the backend when no model context is known", async () => {
  const d = deps(); d.policy.mockResolvedValue(policy("gpu"));
  const legacy = { ...request, inference_steps: 0 };
  await createGenerationGate(d)(legacy);
  expect(d.generate).toHaveBeenCalledWith(legacy);
});

it("uses the backend's real legacy defaults instead of its CPU recommendation when model context is missing", async () => {
  const d = deps();
  d.policy.mockResolvedValue({ ...policy("cpu"), recommended_steps: 30, legacy_inference_steps: 50 });
  await createGenerationGate(d)({ ...request, inference_steps: 0 });
  expect(d.ask).toHaveBeenCalledWith("cpu");
  d.ask.mockClear(); d.policy.mockResolvedValue({ ...policy("cpu"), recommended_steps: 8, legacy_inference_steps: 8 });
  await createGenerationGate(d)({ ...request, inference_steps: 0 });
  expect(d.ask).not.toHaveBeenCalled();
});

it("keeps an unavailable policy conservative for automatic legacy steps without a model", async () => {
  vi.spyOn(backend, "generationPolicy").mockRejectedValue(new Error("Unavailable"));
  const fallback = await loadGenerationPolicy();
  expect(fallback.backend).toBe("unknown"); expect(fallback.legacy_inference_steps).toBe(50);
  const d = deps(); d.policy.mockResolvedValue(fallback);
  await createGenerationGate(d)({ ...request, inference_steps: 0 });
  expect(d.ask).toHaveBeenCalledWith("unknown");
});

const observed = (device: ComponentBackend["backend"], state: ComponentBackend["state"] = "confirmed", engine: BackendStatus["state"] = "running"): BackendStatus => ({
  state: engine,
  synthesis: { state, backend: device, device: device === "metal" ? "MTL0" : null, reason: null },
  language_model: { state: "confirmed", backend: "cpu", device: "CPU", reason: "cpu_requested" },
});
const warning = () => document.querySelector<HTMLElement>("#cpuGenerationWarning")!;
function highSteps() { document.querySelector<HTMLInputElement>('[name="inference_steps"]')!.value = "80"; }

it.each(["cuda", "vulkan", "metal"] as const)("uses confirmed %s synthesis instead of an unknown probe while the language model uses CPU", async device => {
  vi.spyOn(backend, "generationPolicy").mockResolvedValue(policy("unknown"));
  highSteps(); await loadGenerationPolicy(); expect(warning().hidden).toBe(false);
  updateObservedSynthesis(observed(device));
  expect(warning().hidden).toBe(true);
  expect(document.querySelector('[name="inference_steps"]')!.hasAttribute("aria-describedby")).toBe(false);
  const d = deps(); d.policy.mockResolvedValue({ ...policy("unknown"), cpu_iteration_behavior: "limit_30" });
  await createGenerationGate(d)(request);
  expect(d.ask).not.toHaveBeenCalled(); expect(d.generate).toHaveBeenCalledWith(request);
  expect(backend.generationPolicy).toHaveBeenCalledOnce();
});

it("uses confirmed CPU synthesis even when the standalone probe found a GPU", async () => {
  vi.spyOn(backend, "generationPolicy").mockResolvedValue(policy("gpu"));
  highSteps(); await loadGenerationPolicy();
  updateObservedSynthesis(observed("cpu"));
  expect(warning().hidden).toBe(false); expect(warning().textContent).toBe(cpuTranslations.de[0]);
  const d = deps(); d.policy.mockResolvedValue(policy("gpu"));
  await createGenerationGate(d)(request); expect(d.ask).toHaveBeenCalledWith("cpu");
});

it.each([
  undefined,
  observed("unknown", "unconfirmed"),
  observed("metal", "confirmed", "not_started"),
  observed("metal", "confirmed", "stopped"),
  observed("metal", "stopped"),
  observed("unknown"),
])("discards historical GPU evidence when the current health observation is %j", async status => {
  vi.spyOn(backend, "generationPolicy").mockResolvedValue({ ...policy("gpu"), probed_backend: "unknown" });
  highSteps(); await loadGenerationPolicy(); updateObservedSynthesis(observed("metal"));
  expect(warning().hidden).toBe(true);
  updateObservedSynthesis(status);
  expect(warning().hidden).toBe(false); expect(warning().textContent).toBe(cpuTranslations.de[1]);
});

it("keeps a genuine GPU probe as the fallback after observed CPU synthesis stops", async () => {
  vi.spyOn(backend, "generationPolicy").mockResolvedValue({ ...policy("cpu"), probed_backend: "gpu" });
  highSteps(); await loadGenerationPolicy(); updateObservedSynthesis(observed("cpu"));
  expect(warning().hidden).toBe(false);
  updateObservedSynthesis(observed("cpu", "stopped", "stopped"));
  expect(warning().hidden).toBe(true);
});

it("does not let a delayed unknown policy override newer confirmed Metal synthesis or cap the next request", async () => {
  let finish!: (value: GenerationPolicy) => void;
  vi.spyOn(backend, "generationPolicy").mockReturnValue(new Promise(resolve => { finish = resolve; }));
  highSteps(); const pending = loadGenerationPolicy();
  updateObservedSynthesis(observed("metal")); finish({ ...policy("unknown"), probed_backend: "unknown" });
  const result = await pending;
  expect(result.backend).toBe("gpu"); expect(warning().hidden).toBe(true);
  const d = deps(); d.policy.mockResolvedValue({ ...result, cpu_iteration_behavior: "limit_30" });
  await createGenerationGate(d)(request); expect(d.generate).toHaveBeenCalledWith(request);
});

it("does not revive an observed GPU from a delayed policy response after the engine stops", async () => {
  let finish!: (value: GenerationPolicy) => void;
  vi.spyOn(backend, "generationPolicy").mockReturnValue(new Promise(resolve => { finish = resolve; }));
  highSteps(); updateObservedSynthesis(observed("metal"));
  const pending = loadGenerationPolicy();
  updateObservedSynthesis(observed("metal", "stopped", "stopped"));
  finish({ ...policy("gpu"), probed_backend: "unknown" });
  expect((await pending).backend).toBe("unknown");
  expect(warning().hidden).toBe(false); expect(warning().textContent).toBe(cpuTranslations.de[1]);
});

it.each([["metal", "cpu"], ["cpu", "gpu"]] as const)("lets a fresh %s → %s policy supersede older health evidence before admission", async (previous, current) => {
  const response = { ...policy(current), probed_backend: current === "cpu" ? "gpu" : "unknown" } as GenerationPolicy;
  vi.spyOn(backend, "generationPolicy").mockResolvedValue(response);
  highSteps(); updateObservedSynthesis(observed(previous));
  const d = { ...deps(), policy: loadGenerationPolicy };
  await createGenerationGate(d)(request);
  expect(warning().hidden).toBe(current === "gpu");
  if (current === "cpu") expect(d.ask).toHaveBeenCalledWith("cpu");
  else expect(d.ask).not.toHaveBeenCalled();
  expect(d.generate).toHaveBeenCalledWith(request);
});

it("keeps the latest policy backend when an older policy response arrives afterwards", async () => {
  let finishOld!: (value: GenerationPolicy) => void, finishNew!: (value: GenerationPolicy) => void;
  vi.spyOn(backend, "generationPolicy")
    .mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { finishNew = resolve; }));
  highSteps(); updateObservedSynthesis(observed("metal"));
  const old = loadGenerationPolicy(), current = loadGenerationPolicy();
  finishNew({ ...policy("cpu"), probed_backend: "gpu" }); await current;
  finishOld({ ...policy("gpu"), probed_backend: "unknown" });
  expect((await old).backend).toBe("cpu");
  expect(warning().hidden).toBe(false); expect(warning().textContent).toBe(cpuTranslations.de[0]);
  updateObservedSynthesis(observed("cpu", "stopped", "stopped"));
  expect(warning().hidden).toBe(true);
});

it("localizes the checkbox, settings choices, scope and save error in all interface languages", () => {
  expect(Object.keys(cpuBehaviorTranslations).sort()).toEqual(Object.keys(LANGS).sort());
  for (const [language, values] of Object.entries(cpuBehaviorTranslations)) {
    expect(values).toHaveLength(cpuBehaviorKeys.length);
    expect(values.every(v => v.trim())).toBe(true);
    for (const key of cpuBehaviorKeys) expect((I18N as unknown as Record<string, Record<string, string>>)[language][key]).toBeTruthy();
  }
});

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function nativeDialogFixture() {
  const show = vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function(this: HTMLDialogElement) { this.open = true; });
  const close = vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function(this: HTMLDialogElement, value?: string) {
    this.returnValue = value || ""; this.open = false; this.dispatchEvent(new Event("close"));
  });
  return () => { show.mockRestore(); close.mockRestore(); };
}

it.each([["reduce", "limit_30"], ["continue", "continue"]] as const)("remembers %s only after the setting was durably saved", async (choice, behavior) => {
  const cleanup = nativeDialogFixture(); let finish!: () => void;
  const save = vi.fn().mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const pending = askCpuConfirmation("cpu", save);
  const dialog = document.querySelector<HTMLDialogElement>(".cpu-dialog")!;
  const remember = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(remember.checked).toBe(false); remember.checked = true;
  dialog.querySelector<HTMLButtonElement>(`button[value="${choice}"]`)!.click(); await settle();
  expect(save).toHaveBeenCalledWith(behavior); expect(dialog.open).toBe(true);
  expect(dialog.querySelector<HTMLButtonElement>('button[value="continue"]')!.disabled).toBe(true);
  const escape = new Event("cancel", { cancelable: true }); dialog.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true);
  finish(); expect(await pending).toBe(choice); cleanup();
});

it("keeps a failed save visible and permits a one-time answer after unchecking remember", async () => {
  const cleanup = nativeDialogFixture(); const save = vi.fn().mockRejectedValue(new Error("Disk full"));
  const pending = askCpuConfirmation("unknown", save), dialog = document.querySelector<HTMLDialogElement>(".cpu-dialog")!;
  const remember = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!; remember.checked = true;
  dialog.querySelector<HTMLButtonElement>('button[value="reduce"]')!.click(); await settle();
  expect(dialog.open).toBe(true); expect(dialog.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(false);
  expect(dialog.querySelector('[role="alert"]')!.textContent).not.toContain("Disk full");
  setLang("en"); expect(dialog.querySelector('[role="alert"]')!.textContent).toBe(cpuBehaviorTranslations.en[1]);
  remember.checked = false; dialog.querySelector<HTMLButtonElement>('button[value="continue"]')!.click();
  expect(await pending).toBe("continue"); expect(save).toHaveBeenCalledOnce(); cleanup();
});

it.each(["cancel", "escape", "unchecked"])("does not remember on %s", async mode => {
  const cleanup = nativeDialogFixture(); const save = vi.fn();
  const pending = askCpuConfirmation("cpu", save), dialog = document.querySelector<HTMLDialogElement>(".cpu-dialog")!;
  dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked = mode !== "unchecked";
  if (mode === "escape") dialog.close();
  else dialog.querySelector<HTMLButtonElement>(`button[value="${mode === "cancel" ? "cancel" : "continue"}"]`)!.click();
  expect(await pending).toBe(mode === "unchecked" ? "continue" : null); expect(save).not.toHaveBeenCalled(); cleanup();
});
