import { describe, expect, it } from "vitest";
import { generateCode } from "../src/codegen";

describe("generateCode", () => {
  it("returns a string of the requested length", () => {
    expect(generateCode(6)).toHaveLength(6);
    expect(generateCode(10)).toHaveLength(10);
  });

  it("uses only base62 characters", () => {
    expect(generateCode(50)).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("produces unique codes across many calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateCode(6));
    expect(set.size).toBe(100);
  });
});
