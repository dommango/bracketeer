import { describe, expect, it } from "vitest";
import { buildGroupPairMatchNos } from "./data";

describe("buildGroupPairMatchNos", () => {
  it("maps group team pairs to seeded match numbers regardless of home/away order", () => {
    const map = buildGroupPairMatchNos();

    expect(map.get("MEX_RSA")).toBe(1);
    expect(map.get("KOR_MEX")).toBe(2);
    expect(map.get("CZE_KOR")).toBe(6);
    expect(map.get("CRO_ENG")).toBe(67);
    expect(map.get("GHA_PAN")).toBe(72);
  });
});
