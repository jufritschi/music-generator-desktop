// @vitest-environment happy-dom
import { mountStudio } from "./dom-fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import source from "../models/catalog.json";
import title from "../models/title-model.json";
import type { ModelCatalog, ModelSelection, Settings } from "./types";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), modelCatalog: vi.fn(), selectModels: vi.fn(), listen: vi.fn() }));
vi.mock("./backend", () => ({ backend: mocks }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("./i18n.js", async importOriginal => ({ ...(await importOriginal<typeof import("./i18n.js")>()), t: (key: string) => key, applyI18n: vi.fn() }));
const standard: ModelSelection = { provider: "ace-step", synthesis: "acestep-v15-sft-Q8_0.gguf", language: "acestep-5Hz-lm-1.7B-Q8_0.gguf" };
const xl = { ...standard, synthesis: "acestep-v15-xl-sft-Q8_0.gguf" };
const turbo = { ...standard, synthesis: "acestep-v15-turbo-Q8_0.gguf" };
const saved = (selection = standard): Settings => ({ model_provider: selection.provider, synthesis_model: selection.synthesis, lm_model: selection.language, expert_mode: true, recommended_profiles: [standard, xl] }) as Settings;
const events = new Map<string, () => unknown>();
const documentEvents = new Map<string, EventListener>();
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); events.clear();
  mountStudio();
  documentEvents.clear();
  vi.spyOn(document, "addEventListener").mockImplementation((event, listener) => { documentEvents.set(event, listener as EventListener); });
  mocks.settings.mockResolvedValue(saved());
  mocks.listen.mockImplementation(async (event, listener) => { events.set(event, listener); return () => {}; });
  mocks.modelCatalog.mockResolvedValue({ ...source, expert_mode: true, recommended_profiles: [standard, xl], selection: standard,
    hardware: { ram_bytes: 16 * 1024 ** 3, gpu: "CPU", vram_bytes: null, recommended_lm: "1.7B", vae_chunk: 256, platform: "macos", cpu_only: true }, free_bytes: null, models_dir: "/models", busy: false,
    title_model: { ...title.model, present: true, verified: true, partial_bytes: 0 },
    models: source.models.map(model => ({ ...model, present: true, verified: true, partial_bytes: 0 })),
  } as ModelCatalog);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("explains the missing XL recommendation in both simple and Expert Mode", async () => {
  mocks.settings.mockResolvedValue({ ...saved(), expert_mode: false, recommended_profiles: [standard] });
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  const hint = document.querySelector<HTMLElement>("#creatorXlRamHint")!;
  expect(hint.hidden).toBe(false);
  expect(document.querySelector("#creatorModel")!.getAttribute("aria-describedby")).toContain("creatorXlRamHint");
  mocks.settings.mockResolvedValue({ ...saved(), recommended_profiles: [standard] });
  await picker.initializeModelPicker();
  expect(hint.hidden).toBe(false);
  mocks.settings.mockResolvedValue(saved());
  await picker.initializeModelPicker();
  expect(hint.hidden).toBe(true);
  expect(document.querySelector("#creatorModel")!.getAttribute("aria-describedby")).toBe("currentModels");
});

it("keeps a restored song profile when shared title-model installation emits models-changed", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  picker.restoreSongModels(turbo);
  events.get("models-changed")!(); await settle();
  expect(picker.generationModels()).toEqual(turbo);
});

it("ignores a delayed settings snapshot after a newer song restoration", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  let resolve!: (settings: Settings) => void;
  mocks.settings.mockReturnValueOnce(new Promise<Settings>(done => { resolve = done; }));
  events.get("models-changed")!();
  picker.restoreSongModels(turbo);
  resolve(saved(xl)); await settle();
  expect(picker.generationModels()).toEqual(turbo);
});

it("lets a later song restoration win over an in-flight Creator activation", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  let resolve!: (selection: ModelSelection) => void;
  mocks.selectModels.mockReturnValueOnce(new Promise<ModelSelection>(done => { resolve = done; }));
  const select = document.querySelector<HTMLSelectElement>("#creatorModel")!;
  select.value = JSON.stringify([xl.provider, xl.synthesis, xl.language]);
  select.dispatchEvent(new Event("change"));
  expect(mocks.selectModels).toHaveBeenCalledWith(xl);
  picker.restoreSongModels(turbo);
  resolve(xl); await settle();
  expect(picker.generationModels()).toEqual(turbo);
});

it("still adopts a genuinely changed persisted default when there is no newer local intent", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  mocks.settings.mockResolvedValue(saved(xl));
  events.get("models-changed")!(); await settle();
  expect(picker.generationModels()).toEqual(xl);
});

it("preserves local intent on returning from the wizard, but adopts a completed setup", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  picker.restoreSongModels(turbo);
  await picker.initializeModelPicker();
  expect(picker.generationModels()).toEqual(turbo);
  mocks.settings.mockResolvedValue(saved(xl));
  await picker.initializeModelPicker(true);
  expect(picker.generationModels()).toEqual(xl);
});

it("does not surface an old activation error after a newer song restoration", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  let reject!: (error: Error) => void;
  mocks.selectModels.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  const select = document.querySelector<HTMLSelectElement>("#creatorModel")!;
  select.value = JSON.stringify([xl.provider, xl.synthesis, xl.language]);
  select.dispatchEvent(new Event("change"));
  picker.restoreSongModels(turbo);
  reject(new Error("model_setup_required")); await settle();
  expect(picker.generationModels()).toEqual(turbo);
  expect(document.querySelector<HTMLElement>("#creatorModelNotice")!.hidden).toBe(true);
});

it("keeps a newer Expert Mode update even when Creator activation completes first", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  let resolve!: (settings: Settings) => void;
  mocks.settings.mockReturnValueOnce(new Promise<Settings>(done => { resolve = done; }));
  events.get("settings-changed")!();
  mocks.selectModels.mockResolvedValue(xl);
  const select = document.querySelector<HTMLSelectElement>("#creatorModel")!;
  select.value = JSON.stringify([xl.provider, xl.synthesis, xl.language]);
  select.dispatchEvent(new Event("change")); await settle();
  resolve({ ...saved(xl), expert_mode: false }); await settle();
  picker.restoreSongModels(turbo);
  expect(picker.generationModelAllowed()).toBe(false);
});

it("does not let an older catalog overwrite newer Expert Mode metadata", async () => {
  const picker = await import("./model-picker");
  await picker.initializeModelPicker();
  const catalog = await mocks.modelCatalog();
  let resolve!: (catalog: ModelCatalog) => void;
  mocks.modelCatalog.mockReturnValueOnce(new Promise<ModelCatalog>(done => { resolve = done; }));
  documentEvents.get("open-model-picker")!(new Event("open-model-picker"));
  mocks.settings.mockResolvedValue({ ...saved(), expert_mode: false });
  events.get("settings-changed")!(); await settle();
  resolve(catalog); await settle();
  picker.restoreSongModels(turbo);
  expect(picker.generationModelAllowed()).toBe(false);
  expect(Array.from(document.querySelector<HTMLSelectElement>("#modelSynthesis")!.options).some(option => option.value === turbo.synthesis)).toBe(false);
});
