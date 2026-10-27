// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import type { ModelSelection, Song } from "./types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), current: undefined as ModelSelection | undefined }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, convertFileSrc: (path: string) => path }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => vi.fn()) }));
vi.mock("./dialogs", () => ({ notify: vi.fn(), askName: vi.fn() }));
vi.mock("./model-picker", () => ({ generationModels: () => mocks.current, generationModelAllowed: () => true, restoreSongModels: (profile?: ModelSelection) => { if (profile) mocks.current = profile; } }));

const standard = { provider: "ace-step", synthesis: "acestep-v15-sft-Q8_0.gguf", language: "lm" };
let songs: Song[] = [];
let song: Song;
let mediaDuration = 0, mediaTime = 0, mediaPlaying = false;
const mediaEvents = new Map<string, () => void>();
const form = () => document.querySelector<HTMLFormElement>("#genForm")!;
const field = (name: string) => form().elements.namedItem(name) as HTMLInputElement;
const row = () => document.querySelector<HTMLElement>("#library .song")!;
const settle = async () => { await vi.advanceTimersByTimeAsync(0); };
const calls = (command: string) => mocks.invoke.mock.calls.filter(([name]) => name === command);
const show = async () => { songs = [song]; window.dispatchEvent(new Event("focus")); await settle(); };

beforeAll(async () => {
  vi.useFakeTimers(); mountStudio(); localStorage.setItem("ui_lang", "de");
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("WaveSurfer", { create: () => ({
    on: (name: string, callback: () => void) => { mediaEvents.set(name, callback); },
    getDuration: () => mediaDuration, getCurrentTime: () => mediaTime, isPlaying: () => mediaPlaying,
    load: async () => { mediaEvents.get("ready")?.(); },
    play: () => { mediaPlaying = true; mediaEvents.get("play")?.(); },
    pause: () => { mediaPlaying = false; mediaEvents.get("pause")?.(); },
    playPause: () => {}, setVolume: () => {},
  }) });
  for (const selector of ["#genForm", "#settingsForm"]) {
    const node = document.querySelector<HTMLFormElement>(selector)!;
    for (const input of node.querySelectorAll<HTMLInputElement>("[name]")) Object.defineProperty(node, input.name, { configurable: true, value: input });
  }
  form().noValidate = true;
  mocks.invoke.mockImplementation(async (name: string) => {
    switch (name) {
      case "health": return { ok: true };
      case "get_settings": return { export_format: "wav", lm_device: "auto" };
      case "generation_policy": return { backend: "gpu", cpu_iteration_behavior: "ask", recommended_steps: 80, defaults: { duration: 90, bpm: 0, inference_steps: 80, lm_temperature: 1.2, variants: 2 } };
      case "list_folders": return { folders: [], all: songs.length, none: songs.length };
      case "list_songs": return songs;
      case "queue": return { running: [], library: null };
      case "generate": return { ids: ["new"] };
      case "retry_song": return song;
      default: throw new Error(`Unexpected command: ${name}`);
    }
  });
  const studio = await import("./studio.js"); await studio.studioReady; await settle();
});
beforeEach(async () => {
  mocks.invoke.mockClear(); mocks.current = { ...standard }; form().reset(); mediaPlaying = false;
  song = { id: "saved", group_id: "group", created_at: "2026-10-27T10:00:00Z", finished_at: null, status: "done", message: null, title: "Saved song", caption: "quiet piano", lyrics: "[Instrumental]", seed: 42, params: { prompt: "quiet piano", style: "", lyrics: "[Instrumental]", duration: 30, inference_steps: 120 }, result_meta: { duration: 30 }, file: "saved.wav", audio_missing: false, favorite: false, folder_id: null, letter: "", path: null };
  await show();
});
afterAll(() => { window.dispatchEvent(new Event("pagehide")); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
afterEach(() => { vi.restoreAllMocks(); });

it("shows locally verified effective iterations ahead of historical request and LM metadata", async () => {
  song.result_meta = { duration: 30, inference_steps: 120, effective_inference_steps: 60 }; await show();
  expect(row().querySelector(".m")!.textContent).toContain("60IT");
  expect(row().querySelector(".m")!.textContent).not.toContain("120IT");
  expect(song.params.inference_steps).toBe(120);
});

it("shows new verified 200-step execution while retaining the old 100-step result for historical 120 requests", async () => {
  song.params.inference_steps = 200;
  song.result_meta = { effective_inference_steps: 200, inference_steps_limit: 200 }; await show();
  expect(row().querySelector(".m")!.textContent).toContain("200IT");
  song.params.inference_steps = 120;
  song.result_meta = { inference_steps: 120 }; await show();
  expect(row().querySelector(".m")!.textContent).toContain("100IT");
  expect(song.params.inference_steps).toBe(120);
});

it.each(["queued", "running", "error"] as const)("shows the requested 200-step settings for a %s song before verified result metadata exists", async status => {
  song.status = status; song.params.inference_steps = 200; song.result_meta = null; await show();
  expect(row().querySelector(".m")!.textContent).toContain("200IT");
  expect(song.params.inference_steps).toBe(200);
});

it.each([["short_audio", 22, "Kürzer als angefordert: 0:22 statt 0:30."], ["long_audio", 44, "Länger als angefordert: 0:44 statt 0:30."]] as const)("shows a clear inline %s warning from measured audio without opening a modal", async (code, actual, text) => {
  song.result_meta = { duration: actual, duration_source: "wav", requested_duration: 30, duration_warning: { code, requested_seconds: 30, actual_seconds: actual } }; await show();
  expect(row().querySelector(".duration-warning")?.textContent).toBe(text);
  expect(document.querySelector("dialog[open]")).toBeNull();
});

it("shows measured 29.8 seconds with the player's whole-second clock without a shortfall warning", async () => {
  song.result_meta = { duration: 29.8, duration_source: "wav", requested_duration: 30 }; await show();
  expect(row().querySelector(".m")!.textContent).toContain("0:29");
  expect(row().querySelector(".duration-warning")).toBeNull();
});

it("reuses a historical 120-step request with its requested steps on the updated engine without changing history", async () => {
  Object.freeze(song.params);
  row().querySelector<HTMLButtonElement>('[data-a="reuse"]')!.click();
  expect(field("inference_steps").value).toBe("120");
  form().dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })); await settle();
  expect(calls("generate")[0][1]).toMatchObject({ request: { inference_steps: 120 } });
  expect(song.params.inference_steps).toBe(120);
});

it.each([[120, false, 120], [200, false, 200], [0, false, 50], [0, true, 8], [undefined, true, 8]] as const)("makes a new variant from %s steps with current turbo=%s using %s effective steps", async (steps, turbo, expected) => {
  song.params.inference_steps = steps;
  if (turbo) mocks.current = { ...standard, synthesis: "acestep-v15-turbo-Q8_0.gguf" };
  Object.freeze(song.params); await show();
  row().querySelector<HTMLButtonElement>('[data-a="more"]')!.click(); await settle();
  expect(calls("generate")[0][1]).toMatchObject({ request: { inference_steps: expected, model_selection: mocks.current } });
  expect(song.params.inference_steps).toBe(steps);
  expect(document.querySelector(".cpu-dialog")).toBeNull();
});

it("lets the backend resolve an unprofiled legacy retry without forcing the local Creator profile", async () => {
  song.status = "error"; song.params.inference_steps = 0;
  mocks.current = { ...standard, synthesis: "acestep-v15-turbo-Q8_0.gguf" }; await show();
  row().querySelector<HTMLButtonElement>('[data-a="retry"]')!.click(); await settle();
  expect(calls("generation_policy").at(-1)?.[1]).toMatchObject({ selection: null });
  expect(calls("retry_song")).toHaveLength(1); expect(song.params.inference_steps).toBe(0);
});

it.each([[true, false, true], [false, true, false]] as const)("checks unprofiled retry with local Turbo=%s against stored Turbo=%s", async (localTurbo, storedTurbo, shouldAsk) => {
  song.status = "error"; song.params.inference_steps = 0;
  mocks.current = { ...standard, synthesis: localTurbo ? "acestep-v15-turbo-Q8_0.gguf" : standard.synthesis }; await show();
  const { backend } = await import("./backend");
  const policy = vi.spyOn(backend, "generationPolicy").mockImplementation(async selection => {
    const turbo = selection ? selection.synthesis.includes("turbo") : storedTurbo;
    return { backend: "cpu", probed_backend: "cpu", legacy_inference_steps: turbo ? 8 : 50, cpu_iteration_behavior: "ask", recommended_steps: turbo ? 8 : 30, defaults: { duration: 90, bpm: 0, inference_steps: turbo ? 8 : 30, lm_temperature: 1.2, variants: 2 } };
  });
  row().querySelector<HTMLButtonElement>('[data-a="retry"]')!.click(); await settle();
  const dialog = document.querySelector<HTMLDialogElement>(".cpu-dialog");
  const asked = Boolean(dialog);
  if (dialog) { dialog.returnValue = "continue"; dialog.dispatchEvent(new Event("close")); await settle(); }
  expect(asked).toBe(shouldAsk); expect(policy.mock.calls.at(-1)?.[0]).toBeUndefined();
  expect(calls("retry_song")).toHaveLength(1); expect(song.params.inference_steps).toBe(0);
});

it("reuses legacy automatic steps with the active Turbo profile instead of inventing Standard defaults", async () => {
  song.params.inference_steps = 0;
  mocks.current = { ...standard, synthesis: "acestep-v15-turbo-Q8_0.gguf" }; await show();
  row().querySelector<HTMLButtonElement>('[data-a="reuse"]')!.click(); await settle();
  expect(field("inference_steps").value).toBe("8");
  expect(song.params.inference_steps).toBe(0);
});

it("hides an unverified historical duration and unknown automatic steps instead of showing LM guesses", async () => {
  song.params.inference_steps = 0;
  song.result_meta = { duration: 85 }; await show();
  expect(row().querySelector(".m")!.textContent).not.toMatch(/IT|1:25|0:30/);
});

it.each([[5.6, "0:05"], [29.8, "0:29"]] as const)("shows the same %s-second audio duration in the library and player, including playback completion", async (seconds, clock) => {
  song.id = `saved-${seconds}`;
  song.result_meta = { duration: seconds, duration_source: "wav" };
  mediaDuration = seconds; mediaTime = 0; await show();
  row().querySelector<HTMLButtonElement>('[data-a="play"]')!.click(); await settle();
  expect(row().querySelector(".m")!.textContent).toContain(clock);
  expect(document.querySelector("#pTime")!.textContent).toBe(`0:00 / ${clock}`);
  mediaTime = seconds; mediaPlaying = false;
  mediaEvents.get("timeupdate")?.(); mediaEvents.get("finish")?.(); await settle();
  expect(row().querySelector(".m")!.textContent).toContain(clock);
  expect(document.querySelector("#pTime")!.textContent).toBe(`${clock} / ${clock}`);
});
