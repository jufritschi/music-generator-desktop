import { backend } from "./backend";
import { dialogDirectory, pathErrorText, rememberDialogFolder } from "./path-dialogs";
import { t } from "./i18n.js";

/** Native selection feeds the same File-based analysis as drops and microphone recordings. */
export function initializeAudioImport(target: HTMLElement, analyze: (file: File) => Promise<void> | void, showError: (message: string) => void): void {
  let selecting = false;
  const choose = async () => {
    if (selecting) return;
    selecting = true;
    try {
      const chosen = await backend.pickAudioFile(await dialogDirectory("audio_import"), t("dialog_audio_import"), t("dialog_audio_filter"));
      if (!chosen) return;
      rememberDialogFolder("audio_import", chosen.directory);
      await analyze(new File([new Uint8Array(chosen.data)], chosen.name));
    } catch (error) { showError(pathErrorText(error)); }
    finally { selecting = false; }
  };
  target.addEventListener("click", () => { void choose(); });
  target.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); void choose(); }
  });
}
