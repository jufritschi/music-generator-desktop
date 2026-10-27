// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import type { BackendStatus, Generation, Settings, SettingsPatch, Song } from "./types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), save: vi.fn(), notify: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, convertFileSrc: (path: string) => path }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => vi.fn()) }));
vi.mock("./dialogs", () => ({ notify: mocks.notify, askName: vi.fn() }));
vi.mock("./model-picker", () => ({ generationModels: () => undefined, generationModelAllowed: () => true, restoreSongModels: vi.fn() }));

let settings: Settings;
let removeListeners: () => void;
const settle = async () => { await vi.advanceTimersByTimeAsync(0); };
const dialog = () => document.querySelector<HTMLDialogElement>("#settingsDlg")!;
const settingsForm = () => document.querySelector<HTMLFormElement>("#settingsForm")!;
const generationForm = () => document.querySelector<HTMLFormElement>("#genForm")!;
const field = (form: HTMLFormElement, name: string) => form.elements.namedItem(name) as HTMLInputElement;
const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;
const calls = (command: string) => mocks.invoke.mock.calls.filter(([name]) => name === command);
const generate = () => generationForm().dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
const hotkey = () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyG", key: "g", altKey: true, bubbles: true, cancelable: true }));

function trackListeners() {
  const documentListeners = vi.spyOn(document, "addEventListener");
  const windowListeners = vi.spyOn(window, "addEventListener");
  return () => {
    for (const [name, listener, options] of documentListeners.mock.calls) document.removeEventListener(name, listener, options);
    for (const [name, listener, options] of windowListeners.mock.calls) window.removeEventListener(name, listener, options);
  };
}

// Model the method=dialog default action, which happy-dom does not implement.
function submitSettings(value = "save") {
  const submitter = settingsForm().querySelector<HTMLButtonElement>(`button[value="${value}"]`)!;
  const event = new SubmitEvent("submit", { submitter, bubbles: true, cancelable: true });
  settingsForm().dispatchEvent(event);
  if (!event.defaultPrevented) dialog().close(value);
  return event;
}

async function openSettings() {
  button("#btnSettings").click();
  await settle();
  expect(dialog().open).toBe(true);
}

beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers();
  localStorage.clear(); localStorage.setItem("ui_lang", "de"); mountStudio();
  // happy-dom incorrectly flags the valid 1.2 temperature against step=0.05.
  generationForm().noValidate = true;
  // Match the browser's HTMLFormElement named-property access used by studio.js.
  for (const form of [settingsForm(), generationForm()]) {
    for (const input of form.querySelectorAll<HTMLInputElement>("[name]")) {
      Object.defineProperty(form, input.name, { configurable: true, value: input });
    }
  }
  removeListeners = trackListeners();
  settings = { expert_mode: false, cpu_iteration_behavior: "ask", timeout_minutes: 30, songs_dir: "/songs", songs_dir_default: "/songs", lm_device: "auto", export_format: "wav", mp3_available: false } as Settings;
  mocks.save.mockImplementation(async (values: SettingsPatch) => { settings = { ...settings, ...values }; return settings; });
  const songs = ["done", "error"].map(status => ({ id: status, status, title: status, caption: "saved song", lyrics: "[Instrumental]", params: { prompt: "saved song", duration: 45 }, seed: 42, result_meta: null } as Song));
  mocks.invoke.mockImplementation(async (name: string, args?: { values?: SettingsPatch }) => {
    switch (name) {
      case "get_settings": return { ...settings };
      case "save_settings": return mocks.save(args!.values);
      case "health": return { ok: true };
      case "generation_policy": return { backend: "gpu", cpu_iteration_behavior: settings.cpu_iteration_behavior, recommended_steps: 80, defaults: { duration: 90, bpm: 0, inference_steps: 80, lm_temperature: 1.2, variants: 2 } };
      case "list_folders": return { folders: [], all: 2, none: 2 };
      case "list_songs": return songs;
      case "queue": return { running: [], library: null };
      case "generate": return { ids: ["new"] };
      case "retry_song": return songs[1];
      default: throw new Error(`Unexpected command: ${name}`);
    }
  });
  await import("./studio.js"); await settle();
  field(generationForm(), "duration").value = "30";
  field(generationForm(), "duration").dispatchEvent(new Event("input", { bubbles: true }));
  field(generationForm(), "prompt").value = "A lighthouse in the rain";
  field(generationForm(), "style").value = "quiet piano";
});

afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  removeListeners();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("blocks generation from the form and Alt+G while settings are open, and releases on cancel", async () => {
  await openSettings();
  generate(); hotkey(); await settle();
  expect(calls("generate")).toHaveLength(0);
  submitSettings("cancel"); await settle();
  expect(calls("save_settings")).toHaveLength(0);
  generate(); await settle();
  expect(calls("generate")).toHaveLength(1);
});

it("blocks all generation entrypoints while an immediate device save survives cancellation", async () => {
  let finish!: (value: Settings) => void;
  mocks.save.mockReturnValueOnce(new Promise<Settings>(resolve => { finish = resolve; }));
  await openSettings();
  const device = field(settingsForm(), "lm_device");
  device.value = "cpu"; device.dispatchEvent(new Event("change", { bubbles: true })); await settle();
  expect(calls("save_settings")[0][1]).toEqual({ values: { lm_device: "cpu" } });
  submitSettings("cancel"); await settle();
  expect(dialog().open).toBe(false);
  generate(); hotkey();
  button('[data-id="done"] [data-a="more"]').click();
  button('[data-id="error"] [data-a="retry"]').click(); await settle();
  expect(calls("generate")).toHaveLength(0);
  expect(calls("retry_song")).toHaveLength(0);
  finish({ ...settings, lm_device: "cpu" }); await settle();
  expect(calls("generate")).toHaveLength(0);
  hotkey(); await settle();
  expect(calls("generate")).toHaveLength(1);
});

it("keeps settings modal until save succeeds, blocks duplicate saves and discards generation attempts", async () => {
  let finish!: (value: Settings) => void;
  mocks.save.mockReturnValueOnce(new Promise<Settings>(resolve => { finish = resolve; }));
  await openSettings(); field(settingsForm(), "lm_device").value = "cpu";
  expect(submitSettings().defaultPrevented).toBe(true);
  await settle();
  expect(dialog().open).toBe(true);
  expect(settingsForm().getAttribute("aria-busy")).toBe("true");
  expect(button("#saveBtn").disabled).toBe(true);
  expect(field(settingsForm(), "lm_device").disabled).toBe(true);
  expect(button("#updCheck").disabled).toBe(true);
  expect(document.querySelector<HTMLElement>("#settingsSaveStatus")!.hidden).toBe(false);
  expect(document.querySelector("#settingsSaveStatus")!.textContent).toBe("Einstellungen werden gespeichert…");
  const readsBefore = calls("get_settings").length;
  document.dispatchEvent(new Event("open-settings"));
  submitSettings(); expect(submitSettings("cancel").defaultPrevented).toBe(true);
  const cancel = new Event("cancel", { cancelable: true }); dialog().dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  generate(); hotkey();
  button('[data-id="done"] [data-a="more"]').click();
  button('[data-id="error"] [data-a="retry"]').click();
  await settle();
  expect(calls("save_settings")).toHaveLength(1);
  expect(calls("generate")).toHaveLength(0);
  expect(calls("retry_song")).toHaveLength(0);
  expect(calls("get_settings")).toHaveLength(readsBefore);
  expect(field(settingsForm(), "lm_device").value).toBe("cpu");
  finish({ ...settings, lm_device: "cpu" }); await settle();
  expect(dialog().open).toBe(false);
  expect(settingsForm().getAttribute("aria-busy")).toBe("false");
  expect(button("#saveBtn").disabled).toBe(false);
  expect(field(settingsForm(), "lm_device").disabled).toBe(false);
  expect(calls("generate")).toHaveLength(0);
  expect(calls("retry_song")).toHaveLength(0);
  button('[data-id="done"] [data-a="more"]').click(); await settle();
  button('[data-id="error"] [data-a="retry"]').click(); await settle();
  expect(calls("generate")).toHaveLength(1);
  expect(calls("retry_song")).toHaveLength(1);
});

it("keeps edited settings and generation inputs on failure and allows an explicit retry", async () => {
  mocks.save.mockRejectedValueOnce("Disk full");
  await openSettings();
  const readsBefore = calls("get_settings").length;
  field(settingsForm(), "lm_device").value = "cpu";
  field(settingsForm(), "timeout_minutes").value = "75";
  submitSettings(); await settle();
  expect(dialog().open).toBe(true);
  expect(button("#saveBtn").disabled).toBe(false);
  expect(field(settingsForm(), "lm_device").value).toBe("cpu");
  expect(field(settingsForm(), "timeout_minutes").value).toBe("75");
  expect(calls("get_settings")).toHaveLength(readsBefore);
  expect(document.querySelector<HTMLElement>("#settingsSaveError")!.hidden).toBe(false);
  expect(document.querySelector("#settingsSaveError")!.textContent).toBe("Fehler: Disk full");
  expect(field(generationForm(), "duration").value).toBe("30");
  expect(field(generationForm(), "prompt").value).toBe("A lighthouse in the rain");
  expect(field(generationForm(), "style").value).toBe("quiet piano");
  generate(); hotkey(); await settle(); expect(calls("generate")).toHaveLength(0);
  submitSettings(); await settle();
  expect(dialog().open).toBe(false);
  expect(calls("save_settings")).toHaveLength(2);
  expect(calls("save_settings")[1][1]).toEqual({ values: { lm_device: "cpu", timeout_minutes: 75 } });
  hotkey(); await settle(); expect(calls("generate")).toHaveLength(1);
});

it.each(["", " \n\t "])("leaves a blank prompt (%j) unchanged while settings are open or saving", async prompt => {
  let finish!: (value: Settings) => void;
  mocks.save.mockReturnValueOnce(new Promise<Settings>(resolve => { finish = resolve; }));
  field(generationForm(), "prompt").value = prompt;
  const badge = document.querySelector<HTMLElement>("#promptGenerated")!;
  await openSettings();
  generate(); hotkey(); await settle();
  expect(field(generationForm(), "prompt").value).toBe(prompt);
  expect(badge.hidden).toBe(true);
  field(settingsForm(), "lm_device").value = "cpu";
  submitSettings(); await settle();
  generate(); hotkey(); await settle();
  expect(field(generationForm(), "prompt").value).toBe(prompt);
  expect(badge.hidden).toBe(true);
  expect(calls("generate")).toHaveLength(0);
  finish({ ...settings, lm_device: "cpu" }); await settle();
  expect(dialog().open).toBe(false);
  expect(calls("generate")).toHaveLength(0);
  hotkey(); await settle();
  expect(field(generationForm(), "prompt").value.trim()).not.toBe("");
  expect(badge.hidden).toBe(false);
  expect(calls("generate")).toHaveLength(1);
  expect(calls("generate")[0][1].request).toMatchObject({
    duration: 30, style: "quiet piano", prompt: field(generationForm(), "prompt").value,
  });
});

it("preserves the displayed form and next IPC payload through auto → cpu → auto", async () => {
  let original: Generation | undefined;
  for (const device of ["cpu", "auto"]) {
    await openSettings(); field(settingsForm(), "lm_device").value = device;
    submitSettings(); await settle();
    expect(dialog().open).toBe(false);
    expect(settings.lm_device).toBe(device);
    expect(field(generationForm(), "duration").value).toBe("30");
    expect(document.querySelector('.slider[data-fmt="dur"] .knob span')!.textContent).toBe("0:30");
    generate(); await settle();
    const payload = calls("generate").at(-1)![1].request as Generation;
    expect(payload).toMatchObject({ duration: 30, prompt: "A lighthouse in the rain", style: "quiet piano" });
    if (original) expect(payload).toEqual(original);
    original = payload;
    await vi.advanceTimersByTimeAsync(600);
  }
});

it("closes unchanged settings without a write and preserves the unavailable MP3 option", async () => {
  await openSettings(); submitSettings(); await settle();
  expect(dialog().open).toBe(false);
  expect(calls("save_settings")).toHaveLength(0);
  expect(settingsForm().querySelector<HTMLOptionElement>('option[value="mp3"]')!.disabled).toBe(true);
});

it("allows cancellation after failure and clears the old error when reopening", async () => {
  mocks.save.mockRejectedValueOnce("mp3_failed");
  await openSettings(); field(settingsForm(), "lm_device").value = "cpu";
  submitSettings(); await settle();
  const { t } = await import("./i18n.js");
  expect(document.querySelector("#settingsSaveError")!.textContent).toBe(`Fehler: ${t("mp3_failed")}`);
  submitSettings("cancel"); await settle();
  expect(dialog().open).toBe(false);
  await openSettings();
  expect(document.querySelector<HTMLElement>("#settingsSaveError")!.hidden).toBe(true);
  expect(field(settingsForm(), "lm_device").value).toBe("auto");
  expect(field(generationForm(), "duration").value).toBe("30");
  hotkey(); await settle(); expect(calls("generate")).toHaveLength(0);
});

it("provides a saving status in every supported language", async () => {
  const { I18N, LANGS } = await import("./i18n.js");
  for (const language of Object.keys(LANGS)) {
    expect((I18N[language as keyof typeof I18N] as Record<string, unknown>).settings_saving).toEqual(expect.any(String));
  }
});

const observedBackend = (backend: "metal" | "cpu", state: BackendStatus["state"] = "running"): BackendStatus => ({
  state,
  synthesis: { state: state === "running" ? "confirmed" : "stopped", backend, device: backend === "metal" ? "MTL0" : "CPU", reason: null },
  language_model: { state: "confirmed", backend: "cpu", device: "CPU", reason: "cpu_requested" },
});

it("uses current confirmed synthesis to update CPU warnings independently of a CPU language model", async () => {
  const { backend } = await import("./backend");
  const { loadGenerationPolicy, updateCpuWarnings } = await import("./generation-policy");
  vi.spyOn(backend, "generationPolicy").mockResolvedValue({ backend: "unknown", cpu_iteration_behavior: "ask", recommended_steps: 30, defaults: { duration: 90, bpm: 0, inference_steps: 30, lm_temperature: 1.2, variants: 2 } });
  field(generationForm(), "inference_steps").value = "80";
  await loadGenerationPolicy(); updateCpuWarnings();
  const warning = document.querySelector<HTMLElement>("#cpuGenerationWarning")!;
  expect(warning.hidden).toBe(false);
  const health = vi.spyOn(backend, "health").mockResolvedValue({ ok: true, backend_status: observedBackend("metal") });
  document.dispatchEvent(new Event("studio-ready")); await settle();
  expect(document.querySelector("#backendStatus")!.getAttribute("aria-label")).toContain("Metal · MTL0");
  expect(warning.hidden).toBe(true);
  expect(field(generationForm(), "inference_steps").closest(".slider")!.classList.contains("cpu-risk")).toBe(false);
  health.mockResolvedValue({ ok: true, backend_status: observedBackend("cpu") });
  document.dispatchEvent(new Event("studio-ready")); await settle();
  expect(warning.hidden).toBe(false);
  expect(warning.textContent).toContain("Die Klangerzeugung läuft auf der CPU.");
  expect(backend.generationPolicy).toHaveBeenCalledOnce();
});

it("does not restore an older GPU observation after a newer stopped health response", async () => {
  const { backend } = await import("./backend");
  const { loadGenerationPolicy } = await import("./generation-policy");
  vi.spyOn(backend, "generationPolicy").mockResolvedValue({ backend: "unknown", cpu_iteration_behavior: "ask", recommended_steps: 30, defaults: { duration: 90, bpm: 0, inference_steps: 30, lm_temperature: 1.2, variants: 2 } });
  field(generationForm(), "inference_steps").value = "80";
  await loadGenerationPolicy();
  let finish!: (value: Awaited<ReturnType<typeof backend.health>>) => void;
  vi.spyOn(backend, "health").mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ok: true, backend_status: observedBackend("metal", "stopped") });
  document.dispatchEvent(new Event("studio-ready")); await settle();
  document.dispatchEvent(new Event("studio-ready")); await settle();
  finish({ ok: true, backend_status: observedBackend("metal") }); await settle();
  expect(document.querySelector<HTMLElement>("#backendStatus")!.dataset.backend).toBe("unknown");
  expect(document.querySelector("#backendStatus")!.getAttribute("aria-label")).not.toContain("MTL0");
  expect(document.querySelector<HTMLElement>("#cpuGenerationWarning")!.hidden).toBe(false);
});

it.each(["gpu", "error"])("ignores a delayed health %s result after a newer authoritative CPU policy", async outcome => {
  const { backend } = await import("./backend");
  const { loadGenerationPolicy } = await import("./generation-policy");
  const cpu = { backend: "cpu", probed_backend: "gpu", cpu_iteration_behavior: "ask", recommended_steps: 30, defaults: { duration: 90, bpm: 0, inference_steps: 30, lm_temperature: 1.2, variants: 2 } } as const;
  vi.spyOn(backend, "generationPolicy").mockResolvedValue(cpu);
  field(generationForm(), "inference_steps").value = "80";
  let finish!: (value: Awaited<ReturnType<typeof backend.health>>) => void, fail!: (error: Error) => void;
  vi.spyOn(backend, "health").mockReturnValueOnce(new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
  document.dispatchEvent(new Event("studio-ready")); await settle();
  await loadGenerationPolicy();
  if (outcome === "gpu") finish({ ok: true, backend_status: observedBackend("metal") });
  else fail(new Error("Old health failure"));
  await settle();
  const warning = document.querySelector<HTMLElement>("#cpuGenerationWarning")!;
  expect(warning.hidden).toBe(false);
  expect(warning.textContent).toContain("Die Klangerzeugung läuft auf der CPU.");
  expect(document.querySelector("#backendStatus")!.getAttribute("aria-label")).not.toContain("MTL0");
});

it("updates detected Metal and the selected LM mode from the existing policy response before inference", async () => {
  const { backend } = await import("./backend");
  const { loadGenerationPolicy } = await import("./generation-policy");
  const response = { backend: "gpu", probed_backend: "gpu", detected_backend: "metal", lm_device: "cpu", cpu_iteration_behavior: "ask", recommended_steps: 80, defaults: { duration: 90, bpm: 0, inference_steps: 80, lm_temperature: 1.2, variants: 2 } } as const;
  const load = vi.spyOn(backend, "generationPolicy").mockResolvedValue(response);
  const healthCalls = calls("health").length;
  await loadGenerationPolicy();
  const chip = document.querySelector<HTMLElement>("#backendStatus")!;
  expect(chip.textContent).toBe("RechenbackendMetal");
  expect(chip.title).toBe("Klangerzeugung: Metal · Erkannt und verfügbar\nSprachmodell: Nur CPU");
  load.mockResolvedValue({ ...response, lm_device: "auto" }); await loadGenerationPolicy();
  expect(chip.title).toContain("Sprachmodell: Automatisch");
  expect(calls("health")).toHaveLength(healthCalls);
  expect(calls("generate")).toHaveLength(0);
});

it.each([["cpu", "cpu", "gpu", "metal"], ["metal", "gpu", "unknown", "unknown"]] as const)("keeps current %s execution when detected availability differs on policy refresh", async (device, backendClass, probed, detected) => {
  const { backend } = await import("./backend");
  const { loadGenerationPolicy } = await import("./generation-policy");
  const current = observedBackend(device);
  vi.spyOn(backend, "health").mockResolvedValue({ ok: true, backend_status: current });
  document.dispatchEvent(new Event("studio-ready")); await settle();
  vi.spyOn(backend, "generationPolicy").mockResolvedValue({ backend: backendClass, probed_backend: probed, detected_backend: detected, lm_device: "auto", backend_status: current, cpu_iteration_behavior: "ask", recommended_steps: 80, defaults: { duration: 90, bpm: 0, inference_steps: 80, lm_temperature: 1.2, variants: 2 } });
  await loadGenerationPolicy();
  const chip = document.querySelector<HTMLElement>("#backendStatus")!;
  expect(chip.dataset.backend).toBe(device);
  expect(chip.dataset.evidence).toBe("observed");
  expect(chip.title).toContain("In der Engine bestätigt");
});

it("keeps the selected automatic LM setting clear when the saved runtime mode uses a CPU fallback", async () => {
  const { backend } = await import("./backend");
  const { loadGenerationPolicy } = await import("./generation-policy");
  settings.mode = "split"; settings.lm_device = "auto";
  vi.spyOn(backend, "generationPolicy").mockResolvedValue({ backend: "gpu", probed_backend: "gpu", detected_backend: "metal", lm_device: "auto", cpu_iteration_behavior: "ask", recommended_steps: 80, defaults: { duration: 90, bpm: 0, inference_steps: 80, lm_temperature: 1.2, variants: 2 } });
  await loadGenerationPolicy();
  await openSettings(); submitSettings(); await settle();
  expect(document.querySelector<HTMLElement>("#backendStatus")!.title).toContain("Sprachmodell: Automatisch");
});
