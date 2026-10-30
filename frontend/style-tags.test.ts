import { describe, expect, it } from "vitest";
import { STYLE_TAGS } from "./prompts";

describe("style chips", () => {
  it("offers sound descriptions next to genre and instruments", () => {
    expect(STYLE_TAGS).toContain("clean studio production");
    expect(STYLE_TAGS).toContain("warm analog synths");
  });

  it("has no duplicate chips", () => {
    expect(new Set(STYLE_TAGS).size).toBe(STYLE_TAGS.length);
  });
});
