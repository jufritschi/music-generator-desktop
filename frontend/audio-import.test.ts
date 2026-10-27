// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke, convertFileSrc: vi.fn() }));
vi.mock("./i18n.js", () => ({ t: (key: string) => key }));
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  document.body.innerHTML = '<button id="choose">Audio</button>';
  invoke.mockImplementation(async (command) => {
    if (command === "dialog_directory") return "/home/test";
    if (command === "pick_audio_file") return { name: "雨.wav", directory: "/music", data: [82, 73, 70, 70] };
  });
});

it.each(["click", "Enter", " "])("native audio selection via %s supplies a File to existing analysis", async (activation) => {
  const { initializeAudioImport } = await import("./audio-import");
  const analyze = vi.fn(), error = vi.fn();
  const button = document.querySelector<HTMLButtonElement>("#choose")!;
  initializeAudioImport(button, analyze, error);
  if (activation === "click") button.click();
  else button.dispatchEvent(new KeyboardEvent("keydown", { key: activation, bubbles: true }));
  await vi.waitFor(() => expect(analyze).toHaveBeenCalledOnce());
  const file: File = analyze.mock.calls[0][0];
  expect(file.name).toBe("雨.wav");
  expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([82, 73, 70, 70]);
  expect(invoke).toHaveBeenCalledWith("pick_audio_file", { directory: "/home/test", title: "dialog_audio_import", filterName: "dialog_audio_filter" });
  expect(JSON.parse(localStorage.getItem("dialog-folders:v1")!).audio_import).toBe("/music");
  expect(error).not.toHaveBeenCalled();
});

it("leaves analysis and history untouched on cancellation and reports native read errors", async () => {
  const { initializeAudioImport } = await import("./audio-import");
  const analyze = vi.fn(), error = vi.fn();
  const button = document.querySelector<HTMLButtonElement>("#choose")!;
  initializeAudioImport(button, analyze, error);
  let finish!: (value: null) => void;
  invoke.mockImplementation(async command => command === "dialog_directory" ? "/home/test" : new Promise(resolve => { finish = resolve; }));
  button.click(); button.click();
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("pick_audio_file", expect.any(Object)));
  expect(invoke.mock.calls.filter(([command]) => command === "pick_audio_file")).toHaveLength(1);
  finish(null);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(analyze).not.toHaveBeenCalled();
  expect(localStorage.getItem("dialog-folders:v1")).toBeNull();
  invoke.mockImplementation(async command => { if (command === "dialog_directory") return "/home/test"; throw new Error("audio_size"); });
  button.click();
  await vi.waitFor(() => expect(error).toHaveBeenCalledWith("audio_size"));
  expect(analyze).not.toHaveBeenCalled();
});
