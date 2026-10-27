// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import { mountStudio } from "./dom-fixture";
import { I18N, setLang, t } from "./i18n.js";
import { LANGS } from "./locales";
import "./backend-i18n";
import { renderBackendStatus, updateBackendReadiness } from "./backend-status";
import type { BackendStatus } from "./types";

const status: BackendStatus = {
  state: "running",
  synthesis: { state: "unconfirmed", backend: "unknown", device: null, reason: null },
  language_model: { state: "confirmed", backend: "vulkan", device: "Vulkan0", reason: "cuda_architecture_unsupported" },
};
beforeEach(() => { mountStudio(); setLang("de"); updateBackendReadiness("unknown", "auto"); });

it("shows only confirmed execution, explains Vulkan and immediately follows language changes", () => {
  const container = document.querySelector<HTMLElement>("#status")!;
  renderBackendStatus(container, status);
  expect(container.querySelector('[role="region"]')?.getAttribute("aria-label")).toBe("Backend-Details");
  expect(container.textContent).toContain("Klangerzeugung: Noch nicht bestätigt");
  expect(container.textContent).toContain("Sprachmodell: Vulkan · Vulkan0");
  expect(container.textContent).toContain("GPU-Architektur wird vom enthaltenen CUDA-Build nicht unterstützt");
  const details = container.querySelector("details")!;
  details.open = true;
  setLang("en");
  expect(container.querySelector('[role="region"]')?.getAttribute("aria-label")).toBe("Backend details");
  expect(container.textContent).toContain("Sound generation: Not confirmed yet");
  expect(container.textContent).toContain("Language model: Vulkan · Vulkan0");
  expect(container.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
});

it("updates synthesis after generation and clears observed devices when the engine stops", () => {
  const container = document.querySelector<HTMLElement>("#status")!;
  renderBackendStatus(container, status);
  const details = container.querySelector("details")!;
  details.open = true;
  renderBackendStatus(container, { ...status, synthesis: { state: "confirmed", backend: "vulkan", device: "Vulkan0", reason: null } });
  expect(container.textContent).toContain("Klangerzeugung: Vulkan · Vulkan0");
  expect(container.textContent).toContain("Ein Grund für die Backend-Auswahl ist nicht belegt.");
  const stopped = { state: "stopped", backend: "unknown", device: null, reason: null } as const;
  renderBackendStatus(container, { state: "stopped", synthesis: stopped, language_model: stopped });
  expect(container.textContent).toContain("Klangerzeugung: Engine beendet");
  expect(container.textContent).not.toContain("Vulkan0");
  expect(container.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
  renderBackendStatus(container, undefined);
  expect(container.textContent).toContain("Klangerzeugung: Unbekannt");
});

it("keeps the studio backend compact and read-only beside the language selector", () => {
  const container = document.querySelector<HTMLElement>("#backendStatus")!;
  renderBackendStatus(container, { ...status, synthesis: { state: "confirmed", backend: "metal", device: "MTL0", reason: null } }, true);
  expect(container.querySelector("details, summary, select, button")).toBeNull();
  expect(container.textContent).toBe("RechenbackendMetal");
  expect(container.getAttribute("aria-label")).toContain("Klangerzeugung: Metal · MTL0");
  const context = document.querySelector("#uiLang")!.parentElement!;
  expect(context.contains(container)).toBe(true);
  expect(context.classList.contains("header-context")).toBe(true);
});

it.each([["metal", "Metal"], ["vulkan", "Vulkan"], ["cuda", "CUDA"], ["cpu", "CPU"]] as const)("shows detected %s before the first model execution without claiming it has run", (backend, name) => {
  const container = document.querySelector<HTMLElement>("#backendStatus")!;
  updateBackendReadiness(backend, "auto");
  const idle = { state: "not_started", backend: "unknown", device: null, reason: null } as const;
  renderBackendStatus(container, { state: "not_started", synthesis: idle, language_model: idle }, true);
  expect(container.querySelector("[data-backend-name]")!.textContent).toBe(name);
  expect(container.textContent).not.toMatch(/gestartet|bestätigt|gelaufen/);
  expect(container.title).toBe(`Klangerzeugung: ${name} · Erkannt und verfügbar\nSprachmodell: Automatisch`);
  expect(container.dataset.evidence).toBe("available");
  expect(container.title).not.toContain("In der Engine bestätigt");
});

it("uses current execution, then returns to verified availability and the selected LM mode when the engine stops", () => {
  const container = document.querySelector<HTMLElement>("#backendStatus")!;
  updateBackendReadiness("cpu", "cpu");
  renderBackendStatus(container, { ...status, synthesis: { state: "confirmed", backend: "metal", device: "MTL0", reason: null } }, true);
  expect(container.dataset.backend).toBe("metal"); expect(container.dataset.evidence).toBe("observed");
  expect(container.title).toContain("Klangerzeugung: Metal · MTL0 · In der Engine bestätigt");
  expect(container.title).toContain("Sprachmodell: Nur CPU · Vulkan · Vulkan0");
  expect(container.textContent).not.toContain("Ein Grund");
  const stopped = { state: "stopped", backend: "unknown", device: null, reason: null } as const;
  renderBackendStatus(container, { state: "stopped", synthesis: stopped, language_model: stopped }, true);
  expect(container.dataset.backend).toBe("cpu"); expect(container.dataset.evidence).toBe("available");
  expect(container.title).toBe("Klangerzeugung: CPU · Erkannt und verfügbar\nSprachmodell: Nur CPU");
  expect(container.title).not.toMatch(/MTL0|Vulkan0|bestätigt/);
});

it("keeps genuine unknown detection honest without an initial engine-state message", () => {
  const container = document.querySelector<HTMLElement>("#backendStatus")!;
  renderBackendStatus(container, undefined, true);
  expect(container.textContent).toBe("RechenbackendUnbekannt");
  expect(container.dataset.evidence).toBe("unknown");
  expect(container.title).not.toMatch(/verfügbar|bestätigt|gestartet/);
});

it("translates the chip and its details in all twelve languages without adding live announcements or replacing focus", () => {
  const container = document.querySelector<HTMLElement>("#backendStatus")!;
  updateBackendReadiness("metal", "cpu"); renderBackendStatus(container, undefined, true);
  container.focus(); const name = container.querySelector("[data-backend-name]");
  for (const language of Object.keys(LANGS) as (keyof typeof I18N)[]) {
    setLang(language);
    expect(container.querySelector(".backend-chip-label")!.textContent).toBe(t("backend_chip_label"));
    expect(container.title).toContain(t("backend_ready"));
    expect(container.title).toContain(t("lm_dev_cpu"));
    expect(container.getAttribute("aria-label")).toContain(t("backend_synthesis"));
    expect(document.activeElement).toBe(container); expect(container.querySelector("[data-backend-name]")).toBe(name);
  }
  expect(container.hasAttribute("aria-live")).toBe(false);
  expect(container.querySelector('[role="status"], [aria-live], details, button, select')).toBeNull();
});
