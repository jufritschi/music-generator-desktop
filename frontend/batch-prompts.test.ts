import { describe, expect, it } from "vitest";
import { MAX_BATCH_PROMPTS, buildBatchRequests, parseBatchPrompts } from "./batch-prompts";

describe("parseBatchPrompts", () => {
  it("splits lines, trims them and skips empty lines", () => {
    expect(parseBatchPrompts("  eins  \n\n zwei\r\n\t\n drei ")).toEqual({ prompts: ["eins", "zwei", "drei"], truncated: false });
  });

  it("drops exact duplicates but keeps the first occurrence order", () => {
    expect(parseBatchPrompts("a\nb\na\nc\nb").prompts).toEqual(["a", "b", "c"]);
  });

  it("caps the list and reports truncation", () => {
    const text = Array.from({ length: MAX_BATCH_PROMPTS + 3 }, (_, i) => `p${i}`).join("\n");
    const result = parseBatchPrompts(text);
    expect(result.prompts).toHaveLength(MAX_BATCH_PROMPTS);
    expect(result.truncated).toBe(true);
  });

  it("returns nothing for blank input", () => {
    expect(parseBatchPrompts(" \n \n")).toEqual({ prompts: [], truncated: false });
  });
});

describe("buildBatchRequests", () => {
  it("creates one request per prompt that shares the group id and base settings", () => {
    const base = { style: "trip hop", duration: 90, variants: 2, seed: -1 };
    const requests = buildBatchRequests(base, ["nacht", "tag"], "group-1");
    expect(requests).toHaveLength(2);
    expect(requests.map(r => r.prompt)).toEqual(["nacht", "tag"]);
    expect(requests.every(r => r.group_id === "group-1" && r.style === "trip hop" && r.duration === 90 && r.variants === 2)).toBe(true);
    expect(requests[0].seed).toBe(-1);
  });

  it("offsets a fixed seed per prompt so the songs differ", () => {
    const requests = buildBatchRequests({ seed: 40 }, ["a", "b", "c"], "g");
    expect(requests.map(r => r.seed)).toEqual([40, 41, 42]);
  });

  it("does not mutate the base request", () => {
    const base = { seed: 5, prompt: "original" };
    buildBatchRequests(base, ["x"], "g");
    expect(base).toEqual({ seed: 5, prompt: "original" });
  });
});
