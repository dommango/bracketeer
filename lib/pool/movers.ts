// Pure score-history logic: deciding which snapshots to persist (dedup) and
// computing movers from a window of snapshots. No DB import — the prisma glue
// lives in scoring.ts (capture) and queries.ts (getMovers selector) so this
// stays unit-testable without a database.

// A single entry's standing at a point in time.
export interface SnapshotPoint {
  entryId: string;
  totalPoints: number;
  rank: number;
}

// A leaderboard row reduced to the fields that define a standing.
export interface LeaderboardPoint {
  entryId: string;
  total: number;
  rank: number;
}

// Of the current leaderboard, return the snapshot rows that should be written:
// entries with no prior snapshot, or whose points OR rank changed since their
// latest snapshot. Unchanged entries are skipped so a no-op recompute (or a
// recompute that only touched other entries) doesn't spam identical rows.
export function snapshotsToWrite(
  latestByEntry: Map<string, SnapshotPoint>,
  leaderboard: LeaderboardPoint[],
): SnapshotPoint[] {
  return leaderboard
    .filter((row) => {
      const prev = latestByEntry.get(row.entryId);
      return !prev || prev.totalPoints !== row.total || prev.rank !== row.rank;
    })
    .map((row) => ({ entryId: row.entryId, totalPoints: row.total, rank: row.rank }));
}

// A computed movement for one entry over a window.
export interface Mover {
  entryId: string;
  pointsGained: number; // current points − baseline points
  rankDelta: number; // baseline rank − current rank (positive = climbed)
  currentRank: number;
  currentPoints: number;
}

// Deltas for every entry in `current`, measured against its `baseline` standing
// at the start of the window. An entry absent from the baseline (new in-window)
// is measured from zero points and its own current rank (rankDelta 0). Sorted by
// points gained desc, then by places climbed desc.
export function computeMovers(
  baseline: Map<string, SnapshotPoint>,
  current: SnapshotPoint[],
): Mover[] {
  return current
    .map((cur) => {
      const base = baseline.get(cur.entryId);
      const basePoints = base?.totalPoints ?? 0;
      const baseRank = base?.rank ?? cur.rank;
      return {
        entryId: cur.entryId,
        pointsGained: cur.totalPoints - basePoints,
        rankDelta: baseRank - cur.rank,
        currentRank: cur.rank,
        currentPoints: cur.totalPoints,
      };
    })
    .sort((a, b) => b.pointsGained - a.pointsGained || b.rankDelta - a.rankDelta);
}
