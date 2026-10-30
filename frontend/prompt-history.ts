import type { Song } from "./types";

/** Anzahl früherer Prompts, die im Verlauf angeboten werden. */
export const PROMPT_HISTORY_LIMIT = 30;

/**
 * Sammelt die Prompts aller Songs, neueste zuerst.
 * Leere Prompts und Doppelungen (ohne Beachtung von Gross-/Kleinschreibung und Leerzeichen) fallen weg.
 */
export function promptHistory(songs: Song[], limit = PROMPT_HISTORY_LIMIT): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const ordered = [...songs].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  for (const song of ordered) {
    const prompt = (song.params?.prompt ?? "").trim();
    if (!prompt) continue;
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(prompt);
    if (result.length >= limit) break;
  }
  return result;
}
