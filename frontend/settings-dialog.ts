import "./settings-i18n";
import { t } from "./i18n.js";

/** Keep settings modal until the durable save completes; never defer generation attempts. */
export function createSettingsDialog(dialog: HTMLDialogElement, save: () => Promise<void>, formatError: (error: unknown) => string) {
  const form = dialog.querySelector<HTMLFormElement>("form")!;
  const status = form.querySelector<HTMLElement>("#settingsSaveStatus")!;
  const error = form.querySelector<HTMLElement>("#settingsSaveError")!;
  let saving = false;
  let failure = "";

  function renderStatus() {
    form.setAttribute("aria-busy", String(saving));
    status.hidden = !saving;
    status.textContent = saving ? t("settings_saving") : "";
    error.hidden = !failure;
    error.textContent = failure ? `${t("error")}: ${failure}` : "";
  }

  form.addEventListener("submit", async (event) => {
    if (saving) { event.preventDefault(); return; }
    if ((event.submitter as HTMLButtonElement | null)?.value === "cancel") return;
    event.preventDefault();
    saving = true;
    failure = "";
    const controls = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement>("input, select, button, textarea")];
    const disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    renderStatus();
    try {
      await save();
      dialog.close("save");
    } catch (cause) {
      failure = formatError(cause);
    } finally {
      controls.forEach((control, index) => { control.disabled = disabled[index]; });
      saving = false;
      renderStatus();
    }
  });
  dialog.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
  document.addEventListener("langchange", renderStatus);

  return {
    isSaving: () => saving,
    blocksGeneration: () => dialog.open || saving,
    resetStatus() { failure = ""; renderStatus(); },
  };
}
