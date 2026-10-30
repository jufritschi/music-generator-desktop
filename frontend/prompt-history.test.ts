import { describe, expect, it } from "vitest";
import { PROMPT_HISTORY_LIMIT, promptHistory } from "./prompt-history";
import type { Song } from "./types";

const song = (created_at: string, prompt: string | undefined) => ({ created_at, params: { prompt } }) as unknown as Song;

describe("promptHistory", () => {
  it("lists prompts newest first", () => {
    const songs = [song("2026-01-01", "alt"), song("2026-03-01", "neu"), song("2026-02-01", "mittel")];
    expect(promptHistory(songs)).toEqual(["neu", "mittel", "alt"]);
  });

  it("removes duplicates regardless of case and surrounding spaces", () => {
    const songs = [song("2026-03-01", " Nachtfahrt "), song("2026-02-01", "nachtfahrt"), song("2026-01-01", "Morgen")];
    expect(promptHistory(songs)).toEqual(["Nachtfahrt", "Morgen"]);
  });

  it("skips songs without a prompt", () => {
    expect(promptHistory([song("2026-01-01", undefined), song("2026-01-02", "   ")])).toEqual([]);
  });

  it("respects the limit", () => {
    const songs = Array.from({ length: PROMPT_HISTORY_LIMIT + 5 }, (_, i) => song(`2026-01-${String(i + 1).padStart(2, "0")}`, `p${i}`));
    expect(promptHistory(songs)).toHaveLength(PROMPT_HISTORY_LIMIT);
  });
});
