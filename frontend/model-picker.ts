import { creatorOptions, profileKey } from "./creator-models";
import { modelAllowed, modelErrorText, modelLabel } from "./expert-mode";
import { listen } from "@tauri-apps/api/event";
import { backend } from "./backend";
import { bytes, element } from "./dom";
import { applyI18n, t } from "./i18n.js";
import { modelName, modelOptions, profile } from "./model-options";
import type { DownloadProgress, ModelCatalog, ModelSelection } from "./types";

let catalog: ModelCatalog | undefined;
let chosen: ModelSelection | undefined;
let draft: ModelSelection;
let downloading = false;
let selecting = false;
let pendingSelection: ModelSelection | undefined;
let initialized = false;
let expertMode = false;
let recommendations: ModelSelection[] = [];
const dialog = () => element<HTMLDialogElement>("#modelPicker");
const picker = <T extends HTMLElement>(id: string) => element<T>(`#${id}`);

export function generationModels(): ModelSelection | undefined {
  return chosen ? { ...chosen } : undefined;
}

// Reuse the saved profile in memory without modifying the song or its sampling values.
export function restoreSongModels(selection?: ModelSelection): void {
  if (!selection || selection.provider !== "ace-step") return;
  chosen = { ...selection };
  pendingSelection = undefined;
  creatorNotice();
  compact();
}

export function generationModelAllowed(): boolean {
  return modelAllowed(chosen, expertMode, recommendations);
}

function compact(): void {
  picker("expertModelWarning").hidden = generationModelAllowed();
  const options = creatorOptions(recommendations, chosen, expertMode);
  const select = picker<HTMLSelectElement>("creatorModel");
  select.replaceChildren(...options.map(option => {
    const node = new Option(option.label, option.value);
    node.disabled = option.disabled;
    return node;
  }));
  if (!options.length) select.append(new Option(t("expert_no_recommendation"), ""));
  select.value = chosen ? profileKey(chosen) : "";
  select.disabled = selecting || downloading || !options.some(option => !option.disabled);
  picker("currentModels").textContent = chosen ? `${t("desktop_language_model")}: ${modelLabel(chosen.language, !generationModelAllowed())}` : "";

}

async function refresh(): Promise<void> {
  catalog = await backend.modelCatalog();
  expertMode = catalog.expert_mode;
  recommendations = catalog.recommended_profiles;
  chosen ??= { ...catalog.selection };
  compact();
}

async function loadSelection(): Promise<void> {
  // Startup keeps its saved-setup fast path: inspect model files only when opening
  // the picker, starting an operation or reacting to an actual model change.
  const settings = await backend.settings();
  expertMode = settings.expert_mode;
  recommendations = settings.recommended_profiles || [];
  chosen = { provider: settings.model_provider || "ace-step", synthesis: settings.synthesis_model || (settings.dit === "xl" ? "acestep-v15-xl-sft-Q8_0.gguf" : "acestep-v15-sft-Q8_0.gguf"), language: settings.lm_model };
  compact();
}

function render(): void {
  if (!catalog) return;
  const provider = picker<HTMLSelectElement>("modelProvider");
  provider.replaceChildren(...catalog.providers.map(p => new Option(`${p.name}${p.status === "planned" ? ` · ${t("picker_planned")}` : ""}`, p.id)));
  provider.value = draft.provider;
  const planned = !catalog.providers.some(p => p.id === draft.provider && p.status === "available");
  for (const node of dialog().querySelectorAll<HTMLElement>("[data-model-expert]")) node.hidden = !catalog.expert_mode;
  picker("modelProviderField").hidden = !catalog.expert_mode;
  picker("modelsCompatibleField").hidden = !catalog.expert_mode;
  picker("modelLanguage").hidden = !catalog.expert_mode;
  picker("modelLanguageRecommendation").hidden = catalog.expert_mode;
  const recommended = recommendations.find(p => p.synthesis === draft.synthesis);
  picker("modelLanguageRecommendation").textContent = recommended ? `${modelLabel(recommended.language, false)} · ${t("desktop_recommended")}` : "—";
  const only = picker<HTMLInputElement>("modelsCompatible").checked;
  for (const role of ["synthesis", "language"] as const) {
    const select = picker<HTMLSelectElement>(role === "synthesis" ? "modelSynthesis" : "modelLanguage");
    select.replaceChildren();
    const groups = new Map<string, HTMLOptGroupElement>();
    for (const model of modelOptions(catalog, draft, role, only)) {
      const fits = profile(catalog, { ...draft, [role]: model.file }).compatible;
      const status = model.verified ? t("picker_installed") : model.present ? t("picker_verify") : t("picker_missing");
      const option = new Option(catalog.expert_mode ? `${modelName(model.file)} · ${bytes(model.estimated_bytes)} · ${status}${fits ? "" : ` · ${t("picker_low_ram")}`}` : modelLabel(model.file, false), model.file);
      if (catalog.expert_mode) {
        let group = groups.get(model.family);
        if (!group) { group = document.createElement("optgroup"); group.label = modelName(model.family); groups.set(model.family, group); select.append(group); }
        group.append(option);
      } else select.append(option);
    }
    if (!Array.from(select.options).some(option => option.value === draft[role])) {
      const blocked = new Option(t("expert_mode_locked"), "");
      blocked.disabled = true;
      select.prepend(blocked);
      select.value = "";
    } else select.value = draft[role];
    select.disabled = planned || downloading;
  }
  const state = profile(catalog, draft);
  picker("modelHardware").textContent = `${catalog.hardware.gpu} · RAM ${bytes(catalog.hardware.ram_bytes)}${catalog.hardware.vram_bytes ? ` · VRAM ${bytes(catalog.hardware.vram_bytes)}` : ""}`;
  picker("modelEstimate").textContent = planned ? "" : `${t("picker_memory")}: ${bytes(state.memory)} · ${t("picker_download")}: ${bytes(state.download)} · ${t("desktop_space")}: ${catalog.free_bytes === null ? "—" : bytes(catalog.free_bytes)}`;
  picker("modelFolder").textContent = catalog.models_dir;
  picker("modelMemoryHint").hidden = planned;
  picker("modelRamWarning").hidden = planned || !state.allowed || state.compatible;
  picker("pickerExpertWarning").hidden = state.allowed;
  picker("modelUseRecommended").hidden = state.allowed || !recommendations.length;
  picker<HTMLButtonElement>("modelUseRecommended").disabled = downloading;
  picker("modelNoRecommendation").hidden = catalog.expert_mode || recommendations.length > 0;
  picker("modelCpuHint").hidden = planned || !catalog.hardware.cpu_only;
  picker("modelDependencies").textContent = planned ? "" : `${t("picker_dependencies")}: ${state.models.filter(m => m.role === "dependency").map(m => `${m.file} (${m.verified ? t("picker_installed") : m.present ? t("picker_verify") : t("picker_missing")})`).join(" · ")}`;
  const title=catalog.title_model;
  picker("titleModelStatus").textContent=`Qwen3 0.6B Q8 · ${bytes(title.estimated_bytes)} · ${t(title.verified?"picker_installed":title.present?"picker_verify":"picker_missing")}`;
  const titleButton=picker<HTMLButtonElement>("titleModelDownload");
  titleButton.textContent=t(title.present?"title_model_verify":"title_model_download");
  titleButton.hidden=title.verified;
  titleButton.disabled=downloading||catalog.busy||(catalog.free_bytes!==null&&!title.present&&Math.max(0,title.estimated_bytes-title.partial_bytes)+64*1024**2>catalog.free_bytes);
  const apply = picker<HTMLButtonElement>("modelApply");
  apply.textContent = state.verified ? t("picker_use") : state.download ? t("picker_download_use") : t("picker_verify_use");
  const existing = draft.provider === catalog.selection.provider && draft.synthesis === catalog.selection.synthesis && draft.language === catalog.selection.language;
  apply.disabled = downloading || !state.allowed || !state.valid || (!state.compatible && !existing) || (catalog.free_bytes !== null && state.download > 0 && state.download + 512 * 1024 ** 2 > catalog.free_bytes);
  picker<HTMLSelectElement>("modelProvider").disabled = downloading;
  picker<HTMLButtonElement>("modelHardwareTest").disabled = downloading;
  picker<HTMLInputElement>("modelsCompatible").disabled = downloading;
  picker<HTMLButtonElement>("modelCancel").hidden = !downloading;
  picker<HTMLButtonElement>("modelRecommended").disabled = downloading || !state.allowed || !state.valid;
  picker("modelStepHint").textContent = state.steps ? `${t("iterations")}: ${state.steps}` : "";
}

async function open(): Promise<void> {
  picker("modelError").textContent = "";
  try {
    if (!downloading) { await refresh(); draft = { ...(pendingSelection || chosen!) }; render(); }
    if (!dialog().open) dialog().showModal();
  } catch (error) {
    picker("modelError").textContent = modelErrorText(error, t);
    if (!dialog().open) dialog().showModal();
  }
}

async function apply(titleOnly = false): Promise<void> {
  downloading = true;
  compact();
  document.body.dataset.modelDownload = "true";
  picker("modelError").textContent = "";
  picker("modelProgressArea").hidden = false;
  const bar = picker<HTMLProgressElement>("modelProgress");
  bar.hidden = false; bar.removeAttribute("value");
  picker("modelProgressText").textContent = t("desktop_verifying");
  render();
  try {
    if(titleOnly) await backend.downloadTitleModel();
    else { chosen = await backend.useModels({ ...draft }); pendingSelection = undefined; creatorNotice(); }
    bar.max = 1; bar.value = 1;
    picker("modelProgressText").textContent = t("picker_selected");
  } catch (error) { picker("modelError").textContent = modelErrorText(error, t); }
  finally {
    downloading = false;
    document.body.dataset.modelDownload = "false";
    try { await refresh(); } catch (error) { picker("modelError").textContent = modelErrorText(error, t); }
    render();
  }
}

export async function initializeModelPicker(): Promise<void> {
  if (initialized) { await loadSelection(); return; }
  initialized = true;
  const openSettings = () => {
    if (dialog().open) dialog().close();
    document.dispatchEvent(new Event("open-settings"));
  };
  picker<HTMLButtonElement>("expertOpenSettings").onclick = openSettings;
  picker<HTMLButtonElement>("pickerExpertSettings").onclick = openSettings;
  picker<HTMLButtonElement>("creatorModelSettings").onclick = openSettings;
  picker<HTMLSelectElement>("creatorModel").onchange = () => { void selectCreatorModel(); };
  picker<HTMLButtonElement>("modelClose").onclick = () => dialog().close();
  picker<HTMLButtonElement>("titleModelDownload").onclick = () => { void apply(true); };
  picker<HTMLButtonElement>("modelUseRecommended").onclick = () => {
    const recommendation = recommendations.find(p => p.synthesis === draft.synthesis) || recommendations[0];
    if (recommendation) { draft = { ...recommendation }; render(); }
  };
  picker<HTMLButtonElement>("modelApply").onclick = () => { void apply(); };
  picker<HTMLButtonElement>("modelCancel").onclick = () => { void backend.cancelModelDownload().catch(error => { picker("modelError").textContent = modelErrorText(error, t); }); };
  picker<HTMLButtonElement>("modelHardwareTest").onclick = () => { if (!downloading) { dialog().close(); document.dispatchEvent(new Event("manage-models")); } };
  picker<HTMLSelectElement>("modelProvider").onchange = () => { draft.provider = picker<HTMLSelectElement>("modelProvider").value; render(); };
  for (const role of ["synthesis", "language"] as const) {
    picker<HTMLSelectElement>(role === "synthesis" ? "modelSynthesis" : "modelLanguage").onchange = (event) => {
      draft[role] = (event.target as HTMLSelectElement).value;
      if (role === "synthesis" && catalog && !catalog.expert_mode) {
        const recommended = recommendations.find(p => p.synthesis === draft.synthesis);
        if (recommended) draft.language = recommended.language;
      }
      render();
    };
  }
  picker<HTMLInputElement>("modelsCompatible").onchange = render;
  picker<HTMLButtonElement>("modelRecommended").onclick = () => {
    if (!catalog) return;
    const steps = profile(catalog, draft).steps;
    if (steps && chosen?.synthesis === draft.synthesis && chosen.provider === draft.provider) {
      const input = element<HTMLInputElement>('#genForm [name="inference_steps"]');
      input.value = String(steps); input.dispatchEvent(new Event("input", { bubbles: true }));
      picker("modelProgressText").textContent = `${t("iterations")}: ${steps}`;
      picker("modelProgressArea").hidden = false;
      picker("modelProgress").hidden = true;
    } else { picker("modelError").textContent = t("picker_select_first"); }
  };
  document.addEventListener("langchange", () => { compact(); if (catalog && draft) render(); });
  document.addEventListener("open-model-picker", () => { void open(); });
  await listen<DownloadProgress>("model-download-progress", ({ payload: p }) => {
    const bar = picker<HTMLProgressElement>("modelProgress");
    bar.max = Math.max(1, p.total); bar.value = p.downloaded;
    const speed = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 }).format(p.bytes_per_second / 1024 ** 2);
    picker("modelProgressText").textContent = `${p.file} · ${t(p.phase === "verifying" ? "desktop_verifying" : "desktop_downloading")} ${bytes(p.downloaded)} / ${bytes(p.total)}${p.bytes_per_second ? ` · ${speed} MiB/s` : ""}`;
  });
  await listen("settings-changed", () => {
    void updateExpertMode().catch(error => { picker("modelError").textContent = modelErrorText(error, t); });
  });
  await listen("models-changed", () => { if (!downloading) void (dialog().open ? refresh().then(render) : loadSelection()).catch(() => {}); });
  applyI18n();
  await loadSelection();
}

function creatorNotice(error?: unknown): void {
  picker("creatorModelError").textContent = error ? modelErrorText(error, t) : "";
  picker("creatorModelNotice").hidden = !error;
}

async function selectCreatorModel(): Promise<void> {
  const value = picker<HTMLSelectElement>("creatorModel").value;
  const option = creatorOptions(recommendations, chosen, expertMode).find(option => option.value === value && !option.disabled);
  if (!option || selecting || downloading) return;
  selecting = true;
  creatorNotice();
  compact();
  try {
    chosen = await backend.selectModels({ ...option.selection });
    pendingSelection = undefined;
  } catch (error) {
    if (error instanceof Error && error.message === "model_setup_required") pendingSelection = { ...option.selection };
    creatorNotice(error);
  } finally {
    selecting = false;
    compact();
  }
}

async function updateExpertMode(): Promise<void> {
  const settings = await backend.settings();
  expertMode = settings.expert_mode;
  recommendations = settings.recommended_profiles || [];
  if (catalog) { catalog.expert_mode = expertMode; catalog.recommended_profiles = recommendations; }
  compact();
  if (dialog().open && catalog) render();
}
