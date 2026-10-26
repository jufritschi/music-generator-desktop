// @vitest-environment happy-dom
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import type { Generation } from "./types";
import { initializeModelPicker, restoreSongModels } from "./model-picker";

const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: ipc.invoke, convertFileSrc: (path: string) => path }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => vi.fn()) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ message: vi.fn(async () => {}) }));

const requests: Generation[] = [];
const profile = { provider: "ace-step", synthesis: "acestep-v15-sft-Q8_0.gguf", language: "acestep-5Hz-lm-1.7B-Q8_0.gguf" };
let generationError: string | undefined;
const form = () => document.querySelector<HTMLFormElement>("#genForm")!;
const field = (name: string) => form().elements.namedItem(name) as HTMLInputElement;
const button = () => document.querySelector<HTMLButtonElement>("#genBtn")!;
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const submit = async () => { form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await settle(); };

beforeAll(async () => {
  vi.useFakeTimers();
  mountStudio();
  // Browsers expose named form controls before the native title/style properties.
  for (const name of ["title", "style"]) Object.defineProperty(form(), name, { value: field(name) });
  ipc.invoke.mockImplementation(async (name: string, args?: Record<string, unknown>) => {
    switch (name) {
      case "health": return { ok: true };
      case "get_settings": return { export_format: "wav", model_provider: profile.provider, synthesis_model: profile.synthesis, lm_model: profile.language, recommended_profiles: [profile], expert_mode: false };
      case "list_folders": return { folders: [], all: 0, none: 0 };
      case "list_songs": return [];
      case "queue": return { running: [], queued: 0, active: false, progress: null, library: { count: 0, bytes: 0 } };
      case "generate": {
        const request = args!.request as Generation;
        expect(field("prompt").value).toBe(request.prompt);
        requests.push(request);
        if (generationError) throw generationError;
        return { ids: ["song-a", "song-b"] };
      }
      default: throw new Error(`Unexpected command: ${name}`);
    }
  });
  const studio = await import("./studio.js");
  await studio.studioReady;
  await initializeModelPicker();
});

beforeEach(() => {
  requests.length = 0;
  generationError = undefined;
  vi.restoreAllMocks();
  form().reset();
  restoreSongModels(profile);
  button().disabled = false;
});

afterAll(() => {
  window.dispatchEvent(new Event("pagehide"));
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shows an automatic prompt before sending it, even when the style is empty", async () => {
  await submit();
  expect(requests).toHaveLength(1);
  expect(field("prompt").value.trim()).not.toBe("");
  expect(requests[0]).toMatchObject({ prompt: field("prompt").value, style: "", variants: 2 });
});

it.each(["", " \n\t "])("fills a blank prompt (%j) without replacing the chosen style or version count", async prompt => {
  field("prompt").value = prompt;
  field("style").value = "trip hop, piano";
  field("variants").value = "4";
  await submit();
  expect(requests).toHaveLength(1);
  expect(field("prompt").value.trim()).not.toBe("");
  expect(requests[0]).toMatchObject({ prompt: field("prompt").value, style: "trip hop, piano", variants: 4 });
});

it("sends an explicit prompt unchanged", async () => {
  field("prompt").value = "  Meine Idee: Regen über Berlin.\nEin leiser Chor.  ";
  await submit();
  expect(requests[0].prompt).toBe("  Meine Idee: Regen über Berlin.\nEin leiser Chor.  ");
});

it.each([true, false])("respects instrumental=%s when selecting the automatic prompt", async instrumental => {
  vi.spyOn(Math, "random").mockReturnValue(0.1);
  field("instrumental").checked = instrumental;
  field("instrumental").dispatchEvent(new Event("change", { bubbles: true }));
  await submit();
  expect(requests[0]).toMatchObject({
    instrumental,
    prompt: instrumental ? "A marching band in slow motion" : "A marching band in slow motion, with a soft female lead",
  });
});

it("keeps the visible prompt after a failure and reuses it until cleared or rerolled", async () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
  generationError = "Engine unavailable";
  await submit();
  const prompt = field("prompt").value;
  expect(prompt.trim()).not.toBe("");
  generationError = undefined;
  await vi.advanceTimersByTimeAsync(600);
  await submit();
  expect(requests.map(request => request.prompt)).toEqual([prompt, prompt]);
  await vi.advanceTimersByTimeAsync(600);
  field("prompt").value = "";
  random.mockReturnValue(0.9);
  await submit();
  expect(requests[2].prompt).toBe(field("prompt").value);
  expect(requests[2].prompt).not.toBe(prompt);
  await vi.advanceTimersByTimeAsync(600);
  random.mockReturnValue(0.1);
  document.querySelector<HTMLButtonElement>("#diceBtn")!.click();
  const rolled = field("prompt").value;
  await submit();
  expect(requests[3].prompt).toBe(rolled);
});

it("leaves an empty prompt alone while the generation button is disabled", async () => {
  button().disabled = true;
  await submit();
  expect(field("prompt").value).toBe("");
  expect(requests).toHaveLength(0);
});

it("leaves an empty prompt alone when the selected model is not allowed", async () => {
  restoreSongModels({ ...profile, synthesis: "acestep-v15-turbo-Q8_0.gguf" });
  await submit();
  expect(field("prompt").value).toBe("");
  expect(requests).toHaveLength(0);
});

it("explains automatic prompts accessibly and updates the hint in all twelve languages", async () => {
  const { I18N, LANGS, setLang } = await import("./i18n.js");
  const hint = document.querySelector<HTMLElement>("#promptAutoHint");
  expect(hint).not.toBeNull();
  expect(field("prompt").getAttribute("aria-describedby")?.split(" ")).toContain("promptAutoHint");
  for (const lang of Object.keys(LANGS) as (keyof typeof I18N)[]) {
    const text = (I18N[lang] as Record<string, unknown>).prompt_auto_hint;
    expect(typeof text, lang).toBe("string");
    expect(text, lang).toBeTruthy();
    setLang(lang);
    expect(hint!.textContent).toBe(text);
  }
  setLang("de");
  expect(hint!.textContent).toBe("Leer lassen: Beim Generieren wird ein zufälliger Prompt eingesetzt und hier angezeigt.");
});
