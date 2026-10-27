// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import manifest from "../models/manifest.json";
import title from "../models/title-model.json";
import type { GenerationPolicy } from "./types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), close: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, convertFileSrc: (path: string) => `asset:${path}` }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ onCloseRequested: mocks.close }) }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); mountStudio(); localStorage.setItem("ui_lang", "de");
  mocks.listen.mockResolvedValue(() => {});
  mocks.invoke.mockImplementation(async name => {
    if (name === "startup_allowed") return true;
    if (name === "setup_estimate") return { missing_bytes: 0, free_bytes: 100 };
    if (name === "generation_policy") return {
      backend: "cpu", cpu_iteration_behavior: "ask", recommended_steps: 30,
      defaults: { duration: 60, bpm: 0, inference_steps: 30, lm_temperature: 1.2, variants: 1 },
    } satisfies GenerationPolicy;
    if (name === "bootstrap") return {
      needs_setup: true, version: "0.1.1", data_dir: "/data", error: null, manifest, title_model: title.model,
      settings: { models_dir: "/models", songs_dir: "/songs", lm_model: "acestep-5Hz-lm-1.7B-Q8_0.gguf", dit: "standard", expert_mode: false },
      hardware: { ram_bytes: 16 * 1024 ** 3, gpu: "CPU", recommended_lm: "1.7B", cpu_only: true },
      recommended_profiles: [{ provider: "ace-step", synthesis: "acestep-v15-sft-Q8_0.gguf", language: "acestep-5Hz-lm-1.7B-Q8_0.gguf" }],
    };
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

it("keeps setup uninitialized when installation is required", async () => {
  mocks.invoke.mockResolvedValueOnce(false);
  await import("./launch");
  await vi.dynamicImportSettled();
  expect(document.querySelector("#setupForm")).toBeNull();
  expect(document.querySelector<HTMLElement>("#setupContent")!.hidden).toBe(true);
  expect(mocks.invoke).not.toHaveBeenCalledWith("bootstrap", undefined);
});

it("initializes the real setup interface for a copied application", async () => {
  await import("./launch");
  await vi.waitFor(() => expect(document.querySelector("#setupForm")).not.toBeNull());
  expect(document.querySelector<HTMLElement>("#setupContent")!.hidden).toBe(false);
  expect(document.querySelector<HTMLInputElement>("#setupModels")!.value).toBe("/models");
  expect(document.querySelector("#hardwareInfo")!.textContent).toContain("CPU");
  await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("startup_complete"));
});
