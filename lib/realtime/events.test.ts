import { describe, it, expect } from "vitest";
import { standaloneChannelId } from "./events";

describe("standaloneChannelId", () => {
  it("namespaces the channel per tournament so boards never cross-trigger", () => {
    expect(standaloneChannelId("t_abc")).toBe("standalone:t_abc");
    expect(standaloneChannelId("t_abc")).not.toBe(standaloneChannelId("t_xyz"));
  });

  it("is a pure deterministic function of the tournament id", () => {
    expect(standaloneChannelId("t_abc")).toBe(standaloneChannelId("t_abc"));
  });
});
