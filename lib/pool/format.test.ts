import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-26T12:00:00Z");

  it("reads 'just now' under a minute", () => {
    expect(formatRelativeTime(new Date("2026-06-26T11:59:30Z"), now)).toBe("Updated just now");
  });

  it("counts minutes under an hour", () => {
    expect(formatRelativeTime(new Date("2026-06-26T11:45:00Z"), now)).toBe("Updated 15m ago");
  });

  it("counts hours under a day", () => {
    expect(formatRelativeTime(new Date("2026-06-26T09:00:00Z"), now)).toBe("Updated 3h ago");
  });

  it("counts days under a week", () => {
    expect(formatRelativeTime(new Date("2026-06-24T12:00:00Z"), now)).toBe("Updated 2d ago");
  });

  it("falls back to a date past a week", () => {
    // Eight days earlier → a "Mon D" date, not a relative count.
    expect(formatRelativeTime(new Date("2026-06-18T12:00:00Z"), now)).toBe("Updated Jun 18");
  });
});
