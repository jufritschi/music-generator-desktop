// @vitest-environment happy-dom
import { mountStudio } from "./dom-fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import manifest from "../models/manifest.json";
import title from "../models/title-model.json";
import type { Bootstrap } from "./types";
const mocks = vi.hoisted(() => ({ estimate: vi.fn(), listen: vi.fn(), setup: vi.fn(), open: vi.fn(), rememberFolder: vi.fn(), dialogDirectory: vi.fn(), previewImport: vi.fn(), importLibrary: vi.fn() }));
vi.mock("./backend", () => ({ backend: mocks }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("./i18n.js", async importOriginal => ({ ...(await importOriginal<typeof import("./i18n.js")>()), LANG: "de", LANGS: { de: "Deutsch" }, applyI18n: vi.fn(), setLang: vi.fn(), t: (key: string) => key }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  mountStudio();
  mocks.estimate.mockResolvedValue({ missing_bytes: 0, free_bytes: 100 });
  mocks.listen.mockResolvedValue(() => {});
  mocks.dialogDirectory.mockImplementation(async (current) => current || "/home/test");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const data = { needs_setup: false, version: "0.1.0", data_dir: "/data", error: null, manifest, title_model: title.model,
    settings: { cpu_iteration_behavior: "ask", models_dir: "/models", songs_dir: "/songs", lm_model: "acestep-5Hz-lm-1.7B-Q8_0.gguf", expert_mode: false, dit: "standard",
      model_provider: "ace-step", synthesis_model: "acestep-v15-sft-Q8_0.gguf", lm_device: "auto", export_format: "wav",
      poll_interval: 1.5, timeout_minutes: 30, mode: "single", vae_chunk: 256, tested_fingerprint: "test", setup_complete: true },
    hardware: { ram_bytes: 16 * 1024 ** 3, gpu: "CPU", recommended_lm: "1.7B", vram_bytes: null, vae_chunk: 256, platform: "macos", cpu_only: true },
    recommended_profiles: [{ provider: "ace-step", synthesis: "acestep-v15-sft-Q8_0.gguf", language: "acestep-5Hz-lm-1.7B-Q8_0.gguf" }],
  } as Bootstrap;

it("restores a different language model when reopening the wizard in Expert Mode", async () => {
  const { showSetup } = await import("./setup");
  await showSetup(data, async () => {});
  expect(document.querySelector<HTMLSelectElement>("#setupLm")!.value).toBe("1.7B");
  expect(document.querySelector<HTMLSelectElement>("#setupLm")!.options).toHaveLength(1);
  await showSetup({ ...data, settings: { ...data.settings, expert_mode: true, lm_model: "acestep-5Hz-lm-4B-Q8_0.gguf" } }, async () => {});
  const lm = document.querySelector<HTMLSelectElement>("#setupLm")!;
  expect(lm.value).toBe("4B");
  expect(lm.disabled).toBe(false);
  expect(lm.options).toHaveLength(3);
  expect(mocks.estimate).toHaveBeenLastCalledWith(expect.objectContaining({ lm: "4B" }));
});

it("debounces editable paths, trims them and ignores an estimate made before a newer edit", async () => {
  vi.useFakeTimers();
  const { showSetup } = await import("./setup");
  await showSetup(data, async () => {});
  let finish!: (value: { missing_bytes: number; free_bytes: number }) => void;
  mocks.estimate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const field = document.querySelector<HTMLInputElement>("#setupModels")!;
  field.value = "  /new models/音楽  "; field.dispatchEvent(new Event("input", { bubbles: true }));
  await vi.advanceTimersByTimeAsync(299);
  expect(mocks.estimate).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(mocks.estimate).toHaveBeenLastCalledWith(expect.objectContaining({ models_dir: "/new models/音楽" }));
  field.value = "/newer"; field.dispatchEvent(new Event("input", { bubbles: true }));
  finish({ missing_bytes: 999, free_bytes: 999 }); await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector("#spaceEstimate")!.textContent).not.toContain("999");
  await vi.advanceTimersByTimeAsync(300);
  expect(mocks.estimate).toHaveBeenLastCalledWith(expect.objectContaining({ models_dir: "/newer" }));
});

it("reports path errors and rechecks the current input on submission without claiming success", async () => {
  const { showSetup } = await import("./setup");
  const ready = vi.fn();
  await showSetup(data, ready);
  mocks.estimate.mockRejectedValue(new Error("path_absolute"));
  const field = document.querySelector<HTMLInputElement>("#setupSongs")!;
  field.value = "~/songs"; field.dispatchEvent(new Event("change", { bubbles: true }));
  await vi.waitFor(() => expect(document.querySelector("#spaceEstimate")!.textContent).toBe("path_absolute"));
  expect(document.querySelector<HTMLButtonElement>("#setupStart")!.disabled).toBe(true);
  mocks.setup.mockRejectedValue(new Error("path_absolute"));
  document.querySelector("#setupForm")!.dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() => expect(document.querySelector("#setupError")!.textContent).toBe("path_absolute"));
  expect(mocks.setup).toHaveBeenCalledWith(expect.objectContaining({ songs_dir: "~/songs" }));
  expect(ready).not.toHaveBeenCalled();
});

it("uses the edited model folder as native start and preserves text when cancelled or denied", async () => {
  const { showSetup } = await import("./setup");
  await showSetup(data, async () => {});
  const field = document.querySelector<HTMLInputElement>("#setupModels")!;
  field.value = "  /other/models  ";
  mocks.open.mockResolvedValueOnce(null);
  document.querySelector<HTMLButtonElement>('[data-setup-pick="setupModels"]')!.click();
  await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: "/other/models" })));
  expect(field.value).toBe("  /other/models  ");
  mocks.open.mockResolvedValueOnce("/denied"); mocks.rememberFolder.mockRejectedValueOnce(new Error("path_access"));
  document.querySelector<HTMLButtonElement>('[data-setup-pick="setupModels"]')!.click();
  await vi.waitFor(() => expect(document.querySelector("#setupError")!.textContent).toBe("path_access"));
  expect(field.value).toBe("  /other/models  ");
});

it("rechecks a song destination repaired by import and discards the previous estimate", async () => {
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function(this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event("close")); });
  const { showSetup } = await import("./setup");
  await showSetup(structuredClone(data), async () => {});
  const songs = document.querySelector<HTMLInputElement>("#setupSongs")!;
  mocks.estimate.mockRejectedValueOnce(new Error("path_absolute"));
  songs.value = "relative"; songs.dispatchEvent(new Event("change", { bubbles: true }));
  await vi.waitFor(() => expect(document.querySelector("#spaceEstimate")!.textContent).toBe("path_absolute"));
  let finish!: (value: { missing_bytes: number; free_bytes: number }) => void;
  mocks.estimate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  songs.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector<HTMLButtonElement>("#importLibrary")!.click();
  await vi.waitFor(() => expect(document.querySelector<HTMLDialogElement>("#importWizard")!.open).toBe(true));
  mocks.previewImport.mockResolvedValue({ songs: 1, folders: 0, files: 1, bytes: 1, free_bytes: 100, songs_source: "/old/songs", missing: [], issues: [], can_import: true });
  mocks.open.mockResolvedValueOnce("/old");
  document.querySelector<HTMLButtonElement>("#importSourcePick")!.click();
  await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>("#importRun")!.disabled).toBe(false));
  mocks.open.mockResolvedValueOnce("/repaired");
  document.querySelector<HTMLButtonElement>("#importTargetPick")!.click();
  await vi.waitFor(() => expect(document.querySelector("#importTargetPath")!.textContent).toBe("/repaired"));
  await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>("#importRun")!.disabled).toBe(false));
  mocks.importLibrary.mockResolvedValue({ songs: 1, files: 1, songs_dir: "/repaired", missing: [] });
  document.querySelector<HTMLButtonElement>("#importRun")!.click();
  await vi.waitFor(() => expect(songs.value).toBe("/repaired"));
  expect(mocks.estimate).toHaveBeenLastCalledWith(expect.objectContaining({ songs_dir: "/repaired" }));
  finish({ missing_bytes: 999, free_bytes: 999 });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.querySelector("#spaceEstimate")!.textContent).not.toContain("999");
  expect(document.querySelector<HTMLButtonElement>("#setupStart")!.disabled).toBe(false);
});
