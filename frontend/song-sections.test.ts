import { describe, expect, it } from "vitest";
import { applySavedTimes, LEGO_TRACKS, moveBoundary, sectionsFromLyrics, validateRepaint } from "./song-sections";

const lyrics = "[intro]\n\n[verse]\nLine one\n\n[chorus]\nHook\n\n[verse]\nLine two\n\n[chorus]\nHook";

describe("sectionsFromLyrics", () => {
  it("splits the duration evenly along the tags in order", () => {
    const sections = sectionsFromLyrics(lyrics, 120);
    expect(sections.map((s) => s.name)).toEqual(["intro", "verse", "chorus", "verse", "chorus"]);
    expect(sections[0].start).toBe(0);
    expect(sections.at(-1)?.end).toBe(120);
    expect(sections[1].start).toBe(sections[0].end);
  });

  it("numbers repeated sections in the label", () => {
    expect(sectionsFromLyrics(lyrics, 120).map((s) => s.label)).toEqual(["intro", "verse", "chorus", "verse 2", "chorus 2"]);
  });

  it("returns one section for instrumental or untagged songs", () => {
    expect(sectionsFromLyrics("[Instrumental]", 60)).toEqual([{ name: "", label: "", start: 0, end: 60 }]);
    expect(sectionsFromLyrics("", 60)).toHaveLength(1);
  });

  it("returns nothing without a usable duration", () => {
    expect(sectionsFromLyrics(lyrics, 0)).toEqual([]);
    expect(sectionsFromLyrics(lyrics, Number.NaN)).toEqual([]);
  });
});

describe("moveBoundary", () => {
  const base = sectionsFromLyrics("[verse]\n[chorus]\n[verse]", 90);

  it("moves the shared edge of both neighbours", () => {
    const moved = moveBoundary(base, 1, 40, 90);
    expect(moved[0].end).toBe(40);
    expect(moved[1].start).toBe(40);
    expect(moved[2].start).toBe(base[2].start);
  });

  it("keeps each neighbour at least one second long", () => {
    const moved = moveBoundary(base, 1, 0, 90);
    expect(moved[1].start).toBe(base[0].start + 1);
    const right = moveBoundary(base, 1, 500, 90);
    expect(right[1].end).toBe(base[1].end);
    expect(right[0].end).toBe(base[1].end - 1);
  });

  it("ignores the first start and the end", () => {
    expect(moveBoundary(base, 0, 10, 90)).toBe(base);
    expect(moveBoundary(base, 3, 10, 90)).toBe(base);
  });
});

describe("validateRepaint", () => {
  it("accepts a valid range inside the song", () => {
    expect(validateRepaint(30, 60, 120)).toBeNull();
  });

  it("rejects reversed, too short, negative or out-of-song ranges", () => {
    expect(validateRepaint(60, 30, 120)).toBe("sections_err_range");
    expect(validateRepaint(-1, 30, 120)).toBe("sections_err_range");
    expect(validateRepaint(30, 130, 120)).toBe("sections_err_range");
    expect(validateRepaint(30, 30.5, 120)).toBe("sections_err_short");
    expect(validateRepaint(0, 700, 1000)).toBe("sections_err_range");
  });
});

describe("applySavedTimes", () => {
  const base = sectionsFromLyrics("[verse]\n[chorus]", 60);

  it("uses saved times when the section count still matches", () => {
    const saved = [{ start: 0, end: 20 }, { start: 20, end: 60 }];
    expect(applySavedTimes(base, saved)[0].end).toBe(20);
  });

  it("falls back to even times when the structure changed", () => {
    expect(applySavedTimes(base, [{ start: 0, end: 60 }])).toBe(base);
    expect(applySavedTimes(base, null)).toBe(base);
  });

  it("rejects saved times that are not usable", () => {
    expect(applySavedTimes(base, [{ start: 0, end: 0 }, { start: 0, end: 60 }])).toBe(base);
  });
});

describe("LEGO_TRACKS", () => {
  it("matches the track names the engine documents", () => {
    expect(LEGO_TRACKS).toHaveLength(12);
    expect(new Set(LEGO_TRACKS).size).toBe(12);
    expect(LEGO_TRACKS).toContain("guitar");
    expect(LEGO_TRACKS).toContain("strings");
  });
});
