import "./backend-i18n";
import { t } from "./i18n.js";
import type { BackendStatus, ComponentBackend } from "./types";

const views = new Map<HTMLElement, { status: BackendStatus | undefined; compact: boolean }>();
const names = { cuda: "CUDA", vulkan: "Vulkan", metal: "Metal", cpu: "CPU" };

function backendLabel(component: ComponentBackend | undefined): string {
  if (!component) return t("backend_unknown");
  if (component.state !== "confirmed") return t(`backend_${component.state}`);
  return component.backend === "unknown" ? t("backend_unknown") : names[component.backend];
}

/** Update text in place so polling and language changes preserve focus and expanded details. */
export function renderBackendStatus(container: HTMLElement, status: BackendStatus | undefined, compact = false): void {
  views.set(container, { status, compact });
  if (!container.querySelector("[data-backend-details]")) {
    container.innerHTML = `<details data-backend-details class="backend-details"><summary></summary><div class="backend-observations" role="region"><p data-backend-role="synthesis"></p><p data-backend-reason="synthesis" class="small"></p><p data-backend-role="language_model"></p><p data-backend-reason="language_model" class="small"></p></div></details>`;
    container.querySelector("details")!.open = !compact;
  }
  const details = container.querySelector("details")!;
  details.classList.toggle("compact", compact);
  const summary = details.querySelector("summary")!;
  summary.textContent = compact ? `${t("backend_status")}: ${backendLabel(status?.synthesis)}` : t("backend_details");
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
