// @vitest-environment happy-dom
import { mountStudio } from "./dom-fixture";
import { beforeEach, expect, it, vi } from "vitest";
import manifest from "../models/manifest.json";
import title from "../models/title-model.json";
import type { Bootstrap } from "./types";
const mocks = vi.hoisted(() => ({ estimate: vi.fn(), listen: vi.fn() }));
vi.mock("./backend", () => ({ backend: mocks }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("./i18n.js", async importOriginal => ({ ...(await importOriginal<typeof import("./i18n.js")>()), LANG: "de", LANGS: { de: "Deutsch" }, applyI18n: vi.fn(), setLang: vi.fn(), t: (key: string) => key }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  mountStudio();
  mocks.estimate.mockResolvedValue({ missing_bytes: 0, free_bytes: 100 });
  mocks.listen.mockResolvedValue(() => {});
});

it("restores a different language model when reopening the wizard in Expert Mode", async () => {
  const data = { needs_setup: false, version: "0.1.0", data_dir: "/data", error: null, manifest, title_model: title.model,
    settings: { cpu_iteration_behavior: "ask", models_dir: "/models", songs_dir: "/songs", lm_model: "acestep-5Hz-lm-1.7B-Q8_0.gguf", expert_mode: false, dit: "standard",
      model_provider: "ace-step", synthesis_model: "acestep-v15-sft-Q8_0.gguf", lm_device: "auto", export_format: "wav",
      poll_interval: 1.5, timeout_minutes: 30, mode: "single", vae_chunk: 256, tested_fingerprint: "test", setup_complete: true },
    hardware: { ram_bytes: 16 * 1024 ** 3, gpu: "CPU", recommended_lm: "1.7B", vram_bytes: null, vae_chunk: 256, platform: "macos", cpu_only: true },
    recommended_profiles: [{ provider: "ace-step", synthesis: "acestep-v15-sft-Q8_0.gguf", language: "acestep-5Hz-lm-1.7B-Q8_0.gguf" }],
  } as Bootstrap;
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
