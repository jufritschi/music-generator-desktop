// Abschnitte eines Songs (Vers, Refrain, ...) als Zeitbereiche in Sekunden.
// Die Reihenfolge kommt aus den Markierungen im Text, z. B. [verse] oder [chorus].
// Die Zeiten sind zunächst gleichmässig verteilt und können von Hand verschoben werden.

export interface Section {
  name: string;   // Markierung aus dem Text, z. B. "verse"; leer = ganzes Stück
  label: string;  // Anzeige, z. B. "verse 2" beim zweiten Vers
  start: number;  // Sekunden
  end: number;    // Sekunden
}

/** Instrumentspuren, die der Lego-Modus hinzufügen kann (gleiche Liste wie im Backend). */
export const LEGO_TRACKS = [
  "vocals", "backing_vocals", "drums", "bass", "guitar", "keyboard", "percussion", "strings",
  "synth", "fx", "brass", "woodwinds",
] as const;

/** Kürzester erlaubter Abschnitt in Sekunden. */
export const MIN_SECTION = 1;
/** Längste Strecke, die eine Neuerzeugung umfassen darf (wie beim Stapel-Modus der Engine). */
export const MAX_REPAINT_END = 600;

const TAG = /^\s*\[([^\]]+)\]\s*$/;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Zerlegt den Songtext in Abschnitte und verteilt die Länge gleichmässig darauf. */
export function sectionsFromLyrics(lyrics: string | null | undefined, duration: number): Section[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const names = (lyrics ?? "")
    .split("\n")
    .map((line) => line.match(TAG)?.[1].trim() ?? "")
    .filter((name) => name !== "" && name.toLowerCase() !== "instrumental");
  if (names.length < 2) return [{ name: "", label: "", start: 0, end: round(duration) }];
  const seen = new Map<string, number>();
  const step = duration / names.length;
  return names.map((name, i) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return {
      name,
      label: count > 1 ? `${name} ${count}` : name,
      start: i === 0 ? 0 : round(i * step),
      end: i === names.length - 1 ? round(duration) : round((i + 1) * step),
    };
  });
}

/** Übernimmt gespeicherte Zeiten, wenn die Anzahl der Abschnitte noch gleich ist. */
export function applySavedTimes(sections: Section[], saved: { start: number; end: number }[] | null): Section[] {
  if (!saved || saved.length !== sections.length) return sections;
  const valid = saved.every((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
  if (!valid) return sections;
  return sections.map((s, i) => ({ ...s, start: saved[i].start, end: saved[i].end }));
}

/**
 * Verschiebt die Grenze vor Abschnitt i (zwischen i-1 und i) auf `time`.
 * Die Nachbarn bleiben mindestens MIN_SECTION Sekunden lang.
 */
export function moveBoundary(sections: Section[], i: number, time: number, duration: number): Section[] {
  if (i <= 0 || i >= sections.length || !Number.isFinite(time)) return sections;
  const lowest = sections[i - 1].start + MIN_SECTION;
  const highest = sections[i].end - MIN_SECTION;
  const value = round(Math.min(Math.max(time, lowest), Math.min(highest, duration)));
  return sections.map((s, n) => {
    if (n === i - 1) return { ...s, end: value };
    if (n === i) return { ...s, start: value };
    return s;
  });
}

/** Prüft den Zeitbereich für eine Neuerzeugung. Gibt einen Übersetzungsschlüssel zurück oder null. */
export function validateRepaint(start: number, end: number, duration: number): string | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration || end > MAX_REPAINT_END) {
    return "sections_err_range";
  }
  if (end - start < MIN_SECTION) return "sections_err_short";
  return null;
}

/** Speichert die Zeiten pro Song im Browser (nur Komfort; ein Gerät, eine Ansicht). */
export function saveSectionTimes(songId: string, sections: Section[]): void {
  try {
    localStorage.setItem(`sections:${songId}`, JSON.stringify(sections.map(({ start, end }) => ({ start, end }))));
  } catch {}
}

export function loadSectionTimes(songId: string): { start: number; end: number }[] | null {
  try {
    const raw = localStorage.getItem(`sections:${songId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
