// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountStudio } from "./dom-fixture";
import { LANGS } from "./locales";
import { I18N, setLang } from "./i18n.js";
import { settingsKeys, settingsTranslations } from "./desktop-i18n";
import { xlMemoryHints } from "./model-i18n";
import { initializeSettings } from "./settings";
const mocks = vi.hoisted(() => ({ settings: vi.fn(), saveSettings: vi.fn() }));
vi.mock("./backend", () => ({ backend: mocks }));

beforeEach(() => { vi.resetAllMocks(); mountStudio(); setLang("de"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("provides every new message in all registered languages", () => {
  expect(Object.keys(settingsTranslations).sort()).toEqual(Object.keys(LANGS).sort());
  expect(Object.keys(xlMemoryHints).sort()).toEqual(Object.keys(LANGS).sort());
  for (const language of Object.keys(LANGS)) {
    const messages = (I18N as Record<string, Record<string, unknown>>)[language];
    for (const key of [...settingsKeys, "settings_saving", "creator_xl_ram_hint"]) expect(messages[key], `${language}:${key}`).toBeTruthy();
  }
});

it("switches tooltip, accessible name, heading, model hint and a live loading message", async () => {
  mocks.settings.mockReturnValue(new Promise(() => {}));
  initializeSettings();
  const gear = document.querySelector<HTMLButtonElement>("#btnSettings")!;
  gear.click();
  expect(gear.title).toBe("Einstellungen");
  expect(document.querySelector("#settingsStatus")!.textContent).toBe("Einstellungen werden geladen…");
  setLang("en");
  expect(gear.title).toBe("Settings");
  expect(gear.getAttribute("aria-label")).toBe("Settings");
  expect(document.querySelector("#settingsHeading")!.textContent).toBe("Settings");
  expect(document.querySelector("#settingsStatus")!.textContent).toBe("Loading settings…");
  expect(document.querySelector("#creatorXlRamHint")!.textContent).toBe("XL needs more memory and is not recommended for this computer.");
});
