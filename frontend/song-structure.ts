/** Abschnittsfolgen für typische Songaufbauten. Die Namen entsprechen den Markierungen in SECTIONS. */
export const SONG_STRUCTURES = {
  pop: ["[intro]", "[verse]", "[pre-chorus]", "[chorus]", "[verse]", "[pre-chorus]", "[chorus]", "[bridge]", "[chorus]", "[outro]"],
  ballad: ["[verse]", "[verse]", "[chorus]", "[verse]", "[chorus]", "[bridge]", "[chorus]", "[outro]"],
  short: ["[verse]", "[chorus]", "[verse]", "[chorus]", "[outro]"],
} as const;

export type StructureKey = keyof typeof SONG_STRUCTURES;

/**
 * Baut den Text für das Lyrics-Feld: jede Markierung gefolgt von einer leeren Zeile zum Ausfüllen.
 * Die letzte leere Zeile entfällt.
 */
export function structureText(key: StructureKey): string {
  return SONG_STRUCTURES[key].map((section) => `${section}\n`).join("\n").trimEnd() + "\n";
}
