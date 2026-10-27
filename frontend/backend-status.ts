import "./backend-i18n";
import "./backend-chip-i18n";
import { t } from "./i18n.js";
import type { BackendStatus, ComponentBackend } from "./types";

const views = new Map<HTMLElement, { status: BackendStatus | undefined; compact: boolean }>();
const names = { cuda: "CUDA", vulkan: "Vulkan", metal: "Metal", cpu: "CPU" };
let readiness: { backend: ComponentBackend["backend"]; lm_device: "auto" | "cpu" } = { backend: "unknown", lm_device: "auto" };

/** Reuse the existing policy and settings replies; availability does not imply model execution. */
export function updateBackendReadiness(backend?: ComponentBackend["backend"], lmDevice?: "auto" | "cpu", status?: BackendStatus | null): void {
  readiness = { backend: backend ?? readiness.backend, lm_device: lmDevice ?? readiness.lm_device };
  for (const [container, view] of views) {
    if (!container.isConnected) views.delete(container);
    else if (view.compact) renderBackendStatus(container, status === undefined ? view.status : status ?? undefined, true);
  }
}

function backendLabel(component: ComponentBackend | undefined): string {
  if (!component) return t("backend_unknown");
  if (component.state !== "confirmed") return t(`backend_${component.state}`);
  return component.backend === "unknown" ? t("backend_unknown") : names[component.backend];
}

function componentText(component: ComponentBackend): string {
  const name = backendLabel(component);
  return `${name}${component.device && component.device !== name ? ` · ${component.device}` : ""}${component.reason ? ` · ${t(`backend_${component.reason}`)}` : ""}`;
}

/** A focusable informational chip exposes details through its tooltip and accessible name only. */
function renderChip(container: HTMLElement, status: BackendStatus | undefined): void {
  const synthesis = status?.state === "running" && status.synthesis.state === "confirmed" && status.synthesis.backend !== "unknown" ? status.synthesis : undefined;
  const language = status?.state === "running" && status.language_model.state === "confirmed" && status.language_model.backend !== "unknown" ? status.language_model : undefined;
  const backend = synthesis?.backend ?? readiness.backend;
  const name = backend === "unknown" ? t("backend_unknown") : names[backend];
  const evidence = synthesis ? t("backend_observed") : backend !== "unknown" ? t("backend_ready") : "";
  const languageChoice = t(`lm_dev_${readiness.lm_device}`);
  const description = `${t("backend_synthesis")}: ${synthesis ? componentText(synthesis) : name}${evidence ? ` · ${evidence}` : ""}\n${t("backend_language_model")}: ${languageChoice}${language ? ` · ${componentText(language)} · ${t("backend_observed")}` : ""}`;
  if (!container.querySelector("[data-backend-name]")) container.innerHTML = '<span class="backend-chip-label" aria-hidden="true"></span><span class="backend-chip-value" data-backend-name aria-hidden="true"></span>';
  container.classList.add("backend-chip"); container.setAttribute("role", "group"); container.tabIndex = 0;
  container.querySelector(".backend-chip-label")!.textContent = t("backend_chip_label");
  container.querySelector("[data-backend-name]")!.textContent = name;
  container.title = description; container.setAttribute("aria-label", description.replace("\n", ". "));
  container.dataset.backend = backend; container.dataset.evidence = synthesis ? "observed" : backend === "unknown" ? "unknown" : "available";
}

/** Update text in place so polling and language changes preserve focus and expanded details. */
export function renderBackendStatus(container: HTMLElement, status: BackendStatus | undefined, compact = false): void {
  views.set(container, { status, compact });
  if (compact) { renderChip(container, status); return; }
  if (!container.querySelector("[data-backend-details]")) {
    container.innerHTML = `<details data-backend-details class="backend-details"><summary></summary><div class="backend-observations" role="region"><p data-backend-role="synthesis"></p><p data-backend-reason="synthesis" class="small"></p><p data-backend-role="language_model"></p><p data-backend-reason="language_model" class="small"></p></div></details>`;
    container.querySelector("details")!.open = true;
  }
  const details = container.querySelector("details")!;
  const summary = details.querySelector("summary")!;
  summary.textContent = t("backend_details");
  summary.title = summary.textContent;
  details.querySelector('[role="region"]')!.setAttribute("aria-label", t("backend_details"));
  for (const role of ["synthesis", "language_model"] as const) {
    const component = status?.[role];
    const confirmed = component?.state === "confirmed";
    container.querySelector(`[data-backend-role="${role}"]`)!.textContent = `${t(`backend_${role}`)}: ${backendLabel(component)}${confirmed && component.device ? ` · ${component.device}` : ""}`;
    const reason = container.querySelector<HTMLElement>(`[data-backend-reason="${role}"]`)!;
    reason.hidden = !confirmed;
    reason.textContent = confirmed ? t(`backend_${component.reason || "reason_unknown"}`) : "";
  }
}

document.addEventListener("langchange", () => {
  for (const [container, view] of views) {
    if (container.isConnected) renderBackendStatus(container, view.status, view.compact);
    else views.delete(container);
  }
});
