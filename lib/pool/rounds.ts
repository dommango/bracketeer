// Shared round labels + ordering for display surfaces (match center, profile).
// Internal match numbering: group 1–72, R32 73–88, R16 89–96, QF 97–100,
// SF 101–102, bronze 103, final 104. Bronze (103) is intentionally NOT scored
// — mirroring the original tool (see lib/scoring/score.ts).

export type RoundCode = "GROUP" | "R32" | "R16" | "QF" | "SF" | "BRONZE" | "FINAL";

export const ROUND_ORDER: RoundCode[] = ["GROUP", "R32", "R16", "QF", "SF", "BRONZE", "FINAL"];

export const ROUND_LABEL: Record<string, string> = {
  GROUP: "Group stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  BRONZE: "Third-place play-off",
  FINAL: "Final",
};

export function roundLabel(code: string): string {
  return ROUND_LABEL[code] ?? code;
}

// The round a match number belongs to.
export function roundOf(matchNo: number): RoundCode {
  if (matchNo <= 72) return "GROUP";
  if (matchNo <= 88) return "R32";
  if (matchNo <= 96) return "R16";
  if (matchNo <= 100) return "QF";
  if (matchNo <= 102) return "SF";
  if (matchNo === 103) return "BRONZE";
  return "FINAL";
}

// A knockout match that contributes points: every KO match except the bronze
// final (103), which the scoring engine ignores.
export function isScoredKnockout(matchNo: number): boolean {
  return matchNo >= 73 && matchNo <= 104 && matchNo !== 103;
}
