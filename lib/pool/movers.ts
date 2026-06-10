// Pure "biggest mover" diff over snapshot batches — no DB imports, so it stays
// unit-testable without an environment. The DB queries that feed it live in
// snapshots.ts.

export interface SnapRow {
  entryId: string;
  label: string;
  totalPoints: number;
  rank: number;
}

export interface Mover {
  entryId: string;
  label: string;
  total: number;
  deltaPoints: number; // points gained since the previous snapshot batch
  rank: number;
  deltaRank: number; // positions climbed (positive = moved up the table)
}

// Compare two snapshot batches; return entries that changed, biggest gain first.
export function diffSnapshots(prev: SnapRow[], curr: SnapRow[]): Mover[] {
  const prevById = new Map(prev.map((s) => [s.entryId, s]));
  return curr
    .map((c) => {
      const p = prevById.get(c.entryId);
      const prevTotal = p?.totalPoints ?? 0;
      const prevRank = p?.rank ?? c.rank;
      return {
        entryId: c.entryId,
        label: c.label,
        total: c.totalPoints,
        deltaPoints: c.totalPoints - prevTotal,
        rank: c.rank,
        deltaRank: prevRank - c.rank,
      };
    })
    .filter((m) => m.deltaPoints > 0 || m.deltaRank !== 0)
    .sort((a, b) => b.deltaPoints - a.deltaPoints || b.deltaRank - a.deltaRank);
}

export interface TrendPoint {
  capturedAt: Date;
  totalPoints: number;
  rank: number;
}
