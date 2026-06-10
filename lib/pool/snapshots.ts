// DB-backed reads over the appended ScoreSnapshot history: the two-batch "movers"
// comparison and an entry's full trend series. The diff math is the pure
// diffSnapshots in movers.ts.

import { prisma } from "@/lib/db";
import { diffSnapshots, type SnapRow, type Mover, type TrendPoint } from "@/lib/pool/movers";

export interface MoversResult {
  since: Date | null; // timestamp of the batch we compared against
  movers: Mover[];
}

// Top movers in a pool between the two most recent snapshot batches.
export async function getMovers(poolId: string, limit = 3): Promise<MoversResult> {
  const times = await prisma.scoreSnapshot.findMany({
    where: { poolId },
    distinct: ["capturedAt"],
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
    take: 2,
  });
  if (times.length < 2) return { since: null, movers: [] };

  const [curr, prev] = times;
  const batch = (capturedAt: Date) =>
    prisma.scoreSnapshot.findMany({
      where: { poolId, capturedAt },
      select: { entryId: true, totalPoints: true, rank: true, entry: { select: { label: true } } },
    });
  const [c, p] = await Promise.all([batch(curr.capturedAt), batch(prev.capturedAt)]);

  const toRows = (rows: typeof c): SnapRow[] =>
    rows.map((r) => ({
      entryId: r.entryId,
      label: r.entry.label,
      totalPoints: r.totalPoints,
      rank: r.rank,
    }));

  return { since: prev.capturedAt, movers: diffSnapshots(toRows(p), toRows(c)).slice(0, limit) };
}

// An entry's full points/rank series, oldest first, for a sparkline.
export async function getEntryTrend(poolId: string, entryId: string): Promise<TrendPoint[]> {
  return prisma.scoreSnapshot.findMany({
    where: { poolId, entryId },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, totalPoints: true, rank: true },
  });
}
