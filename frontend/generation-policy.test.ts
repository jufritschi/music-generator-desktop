// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import { askCpuConfirmation, createGenerationGate, loadGenerationPolicy, needsCpuConfirmation, updateCpuWarnings } from "./generation-policy";
import { DEFAULT_FORM_PREFERENCES } from "./form-preferences";
import { I18N, setLang } from "./i18n.js";
import { LANGS } from "./locales";
import { cpuTranslations } from "./cpu-i18n";
import type { Generation, GenerationPolicy } from "./types";
const policy = (device: GenerationPolicy["backend"]): GenerationPolicy => ({ backend: device, recommended_steps: device === "gpu" ? 80 : 30, defaults: { ...DEFAULT_FORM_PREFERENCES } });
const request: Generation = { prompt: "piano", inference_steps: 80, duration: 10, seed: 42, variants: 2, group_id: "old-group" };
const deps = () => ({ policy: vi.fn().mockResolvedValue(policy("cpu")), ask: vi.fn().mockResolvedValue("continue"), generate: vi.fn().mockResolvedValue({ ids: ["new"] }), retry: vi.fn().mockResolvedValue({ id: "old" }) });
beforeEach(() => { mountStudio(); setLang("de"); });
afterEach(() => { vi.unstubAllGlobals(); });

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
  expect(warning.hidden).toBe(false); expect(document.getElementById("advBox")!.contains(warning)).toBe(false);
  expect(warning.textContent).toBe(cpuTranslations.de[1]);
  setLang("en"); updateCpuWarnings(); expect(warning.textContent).toBe(cpuTranslations.en[1]);
  input.value = "30"; updateCpuWarnings(); expect(warning.hidden).toBe(true);
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
