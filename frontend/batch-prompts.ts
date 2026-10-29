import type { Generation } from "./types";

/** Obergrenze, damit eine Stapel-Eingabe die Warteschlange nicht unbeabsichtigt überflutet. */
export const MAX_BATCH_PROMPTS = 20;

/**
 * Liest eine Liste von Prompts: ein Prompt pro Zeile.
 * Leere Zeilen und exakte Doppelgänger werden übersprungen.
 * Gibt außerdem zurück, ob Prompts wegen der Obergrenze verworfen wurden.
 */
export function parseBatchPrompts(text: string, max = MAX_BATCH_PROMPTS): { prompts: string[]; truncated: boolean } {
  const seen = new Set<string>();
  const prompts: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    prompts.push(line);
  }
  return { prompts: prompts.slice(0, max), truncated: prompts.length > max };
}

/**
 * Baut für jeden Prompt eine eigene Anfrage.
 * Alle Anfragen teilen sich eine group_id, damit die Bibliothek sie zusammen anzeigt.
 * Ein festes Seed wird pro Prompt um dessen Position erhöht, damit die Songs nicht identisch werden.
 */
export function buildBatchRequests(base: Generation, prompts: string[], groupId: string): Generation[] {
  return prompts.map((prompt, index) => {
    const request: Generation = { ...structuredClone(base), prompt, style: base.style ?? "", group_id: groupId };
    if (typeof base.seed === "number" && base.seed >= 0) request.seed = base.seed + index;
    return request;
  });
}
