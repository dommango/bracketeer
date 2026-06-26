// Shared geometry for the desktop knockout bracket tree — used by both the
// read-only bracket view (app/pool/[code]/Bracket.tsx) and the interactive pick
// builder (BracketTreeBuilder.tsx) so the two can never lay out differently.
// Pure data; client-safe.

import { R16, QF, SF, FINAL } from "@/lib/scoring/data";

// Each knockout match (R16 and up) maps to its two feeder matches.
const FEEDERS: Record<number, [number, number]> = Object.fromEntries(
  [...R16, ...QF, ...SF, FINAL].map((m) => [m.id, [m.a, m.b]]),
);

// Pre-order DFS from the Final (a-branch before b-branch) gives every knockout
// match a top-to-bottom position so its two feeders sit directly beside it — the
// backbone of the desktop bracket tree. Leaves (R32) have no feeders.
export const TREE_ORDER: Record<number, number> = (() => {
  const order: Record<number, number> = {};
  let next = 0;
  const visit = (id: number) => {
    order[id] = next++;
    const feeders = FEEDERS[id];
    if (feeders) {
      visit(feeders[0]);
      visit(feeders[1]);
    }
  };
  visit(FINAL.id);
  return order;
})();

// Each knockout round gets a host-city tint so the bracket reads as a chromatic
// sweep from group-stage green through royal blue, purple, magenta, to gold.
export const ROUND_ACCENT: Record<string, string> = {
  R32: "var(--round-r32)",
  R16: "var(--round-r16)",
  QF: "var(--round-qf)",
  SF: "var(--round-sf)",
  BRONZE: "var(--gold-dark)",
  FINAL: "var(--round-final)",
};

// Order a round's matches top-to-bottom into bracket-tree position.
export function sortByTree<T extends { matchNo: number }>(matches: T[]): T[] {
  return [...matches].sort(
    (a, b) => (TREE_ORDER[a.matchNo] ?? 0) - (TREE_ORDER[b.matchNo] ?? 0),
  );
}

// Internal match number → round code, for picking a card's accent without
// threading the round through every caller. Knockout numbering: 73–88 R32,
// 89–96 R16, 97–100 QF, 101–102 SF, 103 bronze, 104 final.
export function roundCodeForMatch(matchNo: number): string {
  if (matchNo >= 104) return "FINAL";
  if (matchNo === 103) return "BRONZE";
  if (matchNo >= 101) return "SF";
  if (matchNo >= 97) return "QF";
  if (matchNo >= 89) return "R16";
  if (matchNo >= 73) return "R32";
  return "GROUP";
}
