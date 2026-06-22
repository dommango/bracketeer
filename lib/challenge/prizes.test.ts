import { describe, it, expect } from "vitest";
import { selectPrizeWinner } from "./prizes-select";
import type { LeaderboardRow } from "@/lib/pool/scoring";

function row(entryId: string, rank: number, total: number): LeaderboardRow {
  return { rank, entryId, label: entryId, userId: `u-${entryId}`, total, breakdown: null, tiebreak: null };
}

describe("selectPrizeWinner", () => {
  it("picks the sole rank-1 entry", () => {
    const out = selectPrizeWinner([row("a", 1, 50), row("b", 2, 40), row("c", 3, 30)]);
    expect(out.kind).toBe("winner");
    if (out.kind === "winner") expect(out.row.entryId).toBe("a");
  });

  it("flags a rank-1 tie for review (no auto-pick)", () => {
    // Competition ranking: two equal leaders both carry rank 1.
    const out = selectPrizeWinner([row("a", 1, 50), row("b", 1, 50), row("c", 3, 30)]);
    expect(out.kind).toBe("tie");
  });

  it("returns none for an empty board", () => {
    expect(selectPrizeWinner([]).kind).toBe("none");
  });
});
