// Standard competition ranking ("1224"): entries tied on the ranking value share
// the same rank, and the next distinct value skips by the size of the tie. The
// input must already be sorted by that value descending — display order within a
// tie (e.g. by label) is the caller's concern; the rank number itself is
// order-independent (count of entries strictly ahead + 1), so ties always land on
// the same place. `valueOf` defaults to `.total` but can rank by a live total
// (official + provisional) so the standings reflect who is actually ahead now.
export function assignRanks<T extends { total: number }>(
  sorted: readonly T[],
  valueOf: (r: T) => number = (r) => r.total,
): Array<T & { rank: number }> {
  return sorted.map((r) => ({
    ...r,
    rank: sorted.filter((o) => valueOf(o) > valueOf(r)).length + 1,
  }));
}
