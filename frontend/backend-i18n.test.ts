// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { I18N } from "./i18n.js";
import { LANGS } from "./locales";
import "./backend-i18n";
import "./backend-chip-i18n";

it("explains backend evidence and fallback reasons in every interface language", () => {
  const messages = I18N as unknown as Record<string, Record<string, string>>;
  for (const language of Object.keys(LANGS)) {
    for (const key of ["backend_status", "backend_details", "backend_synthesis", "backend_language_model", "backend_not_started", "backend_unconfirmed", "backend_stopped", "backend_unknown", "backend_cpu_requested", "backend_cpu_only", "backend_lm_selftest_failed", "backend_cuda_architecture_unsupported", "backend_cuda_initialization_failed", "backend_reason_unknown", "backend_compatibility", "backend_cuda_compatible", "backend_cuda_incompatible", "backend_cuda_unknown", "backend_driver", "backend_compute_capability", "backend_setup_result", "backend_enter_studio", "backend_chip_label", "backend_ready", "backend_observed"]) {
      expect(messages[language][key]?.trim(), `${language}:${key}`).toBeTruthy();
    }
  }
  expect(messages.de.backend_enter_studio).toBe("Zum Studio");
  expect(messages.en.backend_enter_studio).toBe("Go to studio");
});
