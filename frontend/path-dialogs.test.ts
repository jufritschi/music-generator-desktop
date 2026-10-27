// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, convertFileSrc: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open, save: mocks.save }));
vi.mock("@tauri-apps/api/path", () => ({ join: async (...parts: string[]) => parts.join("/"), dirname: async (path: string) => path.slice(0, path.lastIndexOf("/")) }));
vi.mock("./i18n.js", () => ({ t: (key: string) => key }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); localStorage.clear();
  mocks.invoke.mockImplementation(async (command, args) => {
    if (command === "dialog_directory") return args.current || args.remembered || (args.exporting ? "/home/test/Downloads" : "/home/test");
  });
});
afterEach(() => { vi.restoreAllMocks(); });

it("reports native dialog failures with a translatable key and preserves history", async () => {
  const dialogs = await import("./path-dialogs");
  mocks.open.mockRejectedValueOnce(new Error("Native dialog failed"));
  await expect(dialogs.pickFolder("models")).rejects.toThrow("dialog_failed");
  expect(localStorage.getItem("dialog-folders:v1")).toBeNull();
});

it("still opens native dialogs with damaged or inaccessible preference storage", async () => {
  const dialogs = await import("./path-dialogs");
  localStorage.setItem("dialog-folders:v1", "{bad json");
  mocks.open.mockResolvedValueOnce("/source");
  expect(await dialogs.pickFolder("import_root")).toBe("/source");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
  mocks.open.mockResolvedValueOnce("/songs");
  expect(await dialogs.pickFolder("songs")).toBe("/songs");
});

it("starts each export independently and retains its destination after a reload", async () => {
  let dialogs = await import("./path-dialogs");
  mocks.save.mockResolvedValueOnce("/music/out/Rain.mp3");
  expect(await dialogs.saveExport("export_audio", "Rain.mp3", "mp3")).toBe("/music/out/Rain.mp3");
  expect(mocks.save).toHaveBeenLastCalledWith({ defaultPath: "/home/test/Downloads/Rain.mp3", title: "dialog_export_audio", filters: [{ name: "MP3", extensions: ["mp3"] }] });
  vi.resetModules(); dialogs = await import("./path-dialogs");
  mocks.save.mockResolvedValue(null);
  await dialogs.saveExport("export_lyrics", "Rain.txt", "txt");
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/home/test/Downloads/Rain.txt" }));
  await dialogs.saveExport("export_zip", "Music Generator.zip", "zip");
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/home/test/Downloads/Music Generator.zip" }));
  await dialogs.saveExport("export_audio", "Next.wav", "wav");
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/music/out/Next.wav" }));
});

it("remembers separate folder purposes across reloads and gives edited fields priority", async () => {
  let dialogs = await import("./path-dialogs");
  mocks.open.mockResolvedValueOnce("/web/models");
  expect(await dialogs.pickFolder("models", "", true)).toBe("/web/models");
  expect(mocks.invoke).toHaveBeenCalledWith("remember_folder", { path: "/web/models" });
  vi.resetModules(); dialogs = await import("./path-dialogs");
  mocks.open.mockResolvedValue(null);
  await dialogs.pickFolder("songs");
  expect(mocks.open).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/home/test" }));
  await dialogs.pickFolder("models");
  expect(mocks.open).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/web/models" }));
  await dialogs.pickFolder("models", "  /new/models  ");
  expect(mocks.open).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/new/models" }));
  await dialogs.pickFolder("models");
  expect(mocks.open).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: "/web/models" }));
});
