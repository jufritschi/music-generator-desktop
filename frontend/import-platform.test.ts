// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./import-i18n";
import { setLang } from "./i18n.js";
import { openLibraryAssistant } from "./import-wizard";
import type { ImportPreview } from "./types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));

const get = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const preview: ImportPreview = { songs: 1, folders: 0, files: 1, bytes: 10, free_bytes: 100, songs_source: "/old", missing: [], issues: [], can_import: true };

beforeEach(() => {
  vi.resetAllMocks();
  document.body.replaceChildren();
  setLang("de");
  mocks.listen.mockResolvedValue(() => {});
  mocks.invoke.mockResolvedValue(preview);
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
});
afterEach(() => { vi.restoreAllMocks(); });

const copy = {
  de: {
    plain: {
      target: "Anderen Zielordner wählen…", songs: "Alten Song-Ordner wählen…",
      errors: [
        "Bibliotheksordner ist nicht lesbar. Dateirechte prüfen oder anderen Ordner wählen.",
        "Alter Song-Ordner oder eine Audiodatei ist nicht lesbar. Dateirechte prüfen oder anderen Ordner wählen.",
        "Zielordner ist nicht beschreibbar. Schreibrechte prüfen oder anderen Ordner wählen."
      ]
    },
    macos: {
      target: "Anderen Zielordner wählen / freigeben…", songs: "Alten Song-Ordner wählen / freigeben…",
      errors: [
        "Bibliotheksordner im Dialog erneut freigeben.",
        "Alter Song-Ordner oder eine Audiodatei ist nicht lesbar. Ordner freigeben oder Dateirechte prüfen.",
        "Zielordner ist nicht beschreibbar. Über den Dialog freigeben oder anderen Ordner wählen."
      ]
    }
  },
  en: {
    plain: {
      target: "Choose another destination…", songs: "Choose previous song folder…",
      errors: [
        "Library folder cannot be read. Check file permissions or choose another folder.",
        "Previous song folder or audio file cannot be read. Check file permissions or choose another folder.",
        "Cannot write to destination. Check write permissions or choose another folder."
      ]
    },
    macos: {
      target: "Choose / authorize another destination…", songs: "Choose / authorize previous song folder…",
      errors: [
        "Authorize the library folder again in the dialog.",
        "Previous song folder or audio file cannot be read. Authorize the folder or check file permissions.",
        "Cannot write to destination. Authorize it in the dialog or choose another folder."
      ]
    }
  }
};
const accessIssues = ["source_access", "songs_access", "target_access"];

// Exercise the real backend adapter and translations; only native Tauri APIs are mocked.
async function openAssistant(mode: "import" | "move", platform: string): Promise<void> {
  await openLibraryAssistant(mode, "/songs", platform);
  if (mode === "import") {
    mocks.open.mockResolvedValueOnce("/library");
    get("#importSourcePick").click();
    await vi.waitFor(() => expect(get("#importSummary").textContent).toContain("1"));
  }
}

describe.each(["de", "en"] as const)("%s copy", language => {
  beforeEach(() => { setLang(language); });
  describe.each(["windows", "linux", "macos"])("on %s", platform => {
    const expected = copy[language][platform === "macos" ? "macos" : "plain"];
    describe.each(["import", "move"] as const)("during %s", mode => {
      it("offers platform-appropriate folder selection and sandbox guidance", async () => {
        await openAssistant(mode, platform);
        expect(get("#importTargetPick").textContent).toBe(expected.target);
        expect(get("#importSongsPick").textContent).toBe(expected.songs);
        expect(get("#importSandbox").hidden).toBe(platform !== "macos");
        if (platform === "macos") expect(get("#importSandbox").textContent).toContain("macOS");
      });

      it("explains preview access issues with platform-appropriate guidance", async () => {
        mocks.invoke.mockResolvedValue({ ...preview, can_import: false, issues: accessIssues.map(code => ({ code, path: "/folder" })) });
        await openAssistant(mode, platform);
        expect(Array.from(get("#importIssues").children, item => item.textContent)).toEqual(expected.errors.map(message => `${message} · /folder`));
      });

      it.each(accessIssues)("explains %s when the transfer fails after preview", async code => {
        mocks.invoke.mockImplementation(async (command: string) => {
          if (command === "save_settings" || command === "import_library") throw `import_${code}`;
          return preview;
        });
        await openAssistant(mode, platform);
        get("#importRun").click();
        await vi.waitFor(() => expect(get("#importError").textContent).toBe(expected.errors[accessIssues.indexOf(code)]));
      });
    });
  });
});
