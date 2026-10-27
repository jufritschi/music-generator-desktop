import { modelAllowed, modelLabel } from "./expert-mode";
import type { CatalogModel, ModelCatalog, ModelSelection } from "./types";

export function profileModels(catalog: ModelCatalog, selection: ModelSelection): CatalogModel[] {
  return catalog.models.filter(m => m.provider === selection.provider &&
    (m.role === "dependency" || m.file === selection.synthesis || m.file === selection.language));
}

export function profile(catalog: ModelCatalog, selection: ModelSelection) {
  const models = profileModels(catalog, selection);
  const valid = catalog.providers.some(p => p.id === selection.provider && p.status === "available") &&
    models.some(m => m.role === "synthesis" && m.file === selection.synthesis) &&
    models.some(m => m.role === "language" && m.file === selection.language);
  const memory = models.reduce((n, m) => n + m.estimated_bytes, 0) +
    (selection.synthesis.includes("-xl-") ? 4 : 3) * 1024 ** 3;
  const synthesis = models.find(m => m.role === "synthesis");
  return {
    models, valid, allowed: modelAllowed(selection, catalog.expert_mode, catalog.recommended_profiles), memory, compatible: valid && memory <= catalog.hardware.ram_bytes,
    verified: valid && models.every(m => m.verified),
    download: models.filter(m => !m.present).reduce((n, m) => n + Math.max(0, m.estimated_bytes - m.partial_bytes), 0),
    steps: synthesis?.suggested_steps ?? synthesis?.recommended_steps,
  };
}

export function modelName(file: string): string {
  return modelLabel(file, true);
}

export function modelOptions(catalog: ModelCatalog, selection: ModelSelection, role: "synthesis" | "language", compatibleOnly: boolean): CatalogModel[] {
  const field = role === "synthesis" ? "synthesis" : "language";
  return catalog.models.filter(m => {
    if (m.provider !== selection.provider || m.role !== role) return false;
    if (!catalog.expert_mode) {
      return catalog.recommended_profiles.some(p => p.provider === selection.provider &&
        (role === "synthesis" ? p.synthesis === m.file : p.synthesis === selection.synthesis && p.language === m.file));
    }
    return !compatibleOnly || m.file === selection[field] || profile(catalog, { ...selection, [field]: m.file }).compatible;
  });
}
