// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import { mountStudio } from "./dom-fixture";
import { setLang } from "./i18n.js";
import "./backend-i18n";
import { renderBackendStatus } from "./backend-status";
import type { BackendStatus } from "./types";

const status: BackendStatus = {
  state: "running",
  synthesis: { state: "unconfirmed", backend: "unknown", device: null, reason: null },
  language_model: { state: "confirmed", backend: "vulkan", device: "Vulkan0", reason: "cuda_architecture_unsupported" },
};
beforeEach(() => { mountStudio(); setLang("de"); });

it("shows only confirmed execution, explains Vulkan and immediately follows language changes", () => {
  const container = document.querySelector<HTMLElement>("#status")!;
  renderBackendStatus(container, status, true);
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
  renderBackendStatus(container, status, true);
  const details = container.querySelector("details")!;
  details.open = true;
  renderBackendStatus(container, { ...status, synthesis: { state: "confirmed", backend: "vulkan", device: "Vulkan0", reason: null } }, true);
  expect(container.querySelector("summary")!.textContent).toBe("Rechen-Backend: Vulkan");
  expect(container.textContent).toContain("Ein Grund für die Backend-Auswahl ist nicht belegt.");
  const stopped = { state: "stopped", backend: "unknown", device: null, reason: null } as const;
  renderBackendStatus(container, { state: "stopped", synthesis: stopped, language_model: stopped }, true);
  expect(container.textContent).toContain("Klangerzeugung: Engine beendet");
  expect(container.textContent).not.toContain("Vulkan0");
  expect(container.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
  renderBackendStatus(container, undefined, true);
  expect(container.querySelector("summary")!.textContent).toBe("Rechen-Backend: Unbekannt");
});
