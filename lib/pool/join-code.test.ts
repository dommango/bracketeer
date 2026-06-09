import { describe, it, expect } from "vitest";
import { generateJoinCode, isValidJoinCode, normalizeJoinCode } from "./join-code";

describe("generateJoinCode", () => {
  it("produces a 6-letter uppercase code", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z]{6}$/);
    }
  });

  it("is deterministic under a fixed RNG", () => {
    const seq = [0, 0.5, 0.99, 0.25, 0.75, 0.1];
    let i = 0;
    const rand = () => seq[i++ % seq.length];
    let j = 0;
    const rand2 = () => seq[j++ % seq.length];
    expect(generateJoinCode(rand)).toBe(generateJoinCode(rand2));
  });

  it("maps RNG 0 to A and near-1 to Z", () => {
    expect(generateJoinCode(() => 0)).toBe("AAAAAA");
    expect(generateJoinCode(() => 0.9999)).toBe("ZZZZZZ");
  });
});

describe("isValidJoinCode", () => {
  it("accepts exactly six uppercase letters", () => {
    expect(isValidJoinCode("FIXTUR")).toBe(true);
    expect(isValidJoinCode("ABCDEF")).toBe(true);
  });

  it("rejects wrong length, digits, lowercase", () => {
    expect(isValidJoinCode("ABCDE")).toBe(false);
    expect(isValidJoinCode("ABCDEFG")).toBe(false);
    expect(isValidJoinCode("ABC123")).toBe(false);
    expect(isValidJoinCode("abcdef")).toBe(false);
    expect(isValidJoinCode("")).toBe(false);
  });
});

describe("normalizeJoinCode", () => {
  it("uppercases, trims, and slices to six", () => {
    expect(normalizeJoinCode("  fixtur ")).toBe("FIXTUR");
    expect(normalizeJoinCode("abcdefgh")).toBe("ABCDEF");
  });

  it("returns null when the result is not a valid code", () => {
    expect(normalizeJoinCode("ab")).toBeNull();
    expect(normalizeJoinCode("ab12cd")).toBeNull();
    expect(normalizeJoinCode("")).toBeNull();
  });
});
