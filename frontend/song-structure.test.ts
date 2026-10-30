import { describe, expect, it } from "vitest";
import { SONG_STRUCTURES, structureText } from "./song-structure";
import { SECTIONS } from "./prompts";

describe("song structures", () => {
  it("uses only section markers the app already offers", () => {
    for (const sections of Object.values(SONG_STRUCTURES)) {
      for (const section of sections) expect(SECTIONS).toContain(section);
    }
  });

  it("writes each marker followed by an empty line to fill in", () => {
    expect(structureText("short")).toBe("[verse]\n\n[chorus]\n\n[verse]\n\n[chorus]\n\n[outro]\n");
  });

  it("ends with a single line break", () => {
    expect(structureText("ballad").endsWith("\n")).toBe(true);
    expect(structureText("ballad").endsWith("\n\n")).toBe(false);
  });
});
