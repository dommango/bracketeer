// The tournament stage a scored match belongs to. The ranges mirror
// roundPointsFor in lib/scoring/score.ts BYTE-FOR-BYTE (R32 73–88, R16 89–96,
// QF 97–100, SF 101–102, Final 104; bronze 103 is unscored and maps to null), so
// the daily game can never disagree with the bracket engine on round boundaries.
// Group fixtures (1–72) map to GROUP. Defined here as the shared, stable contract.

export type Stage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL";

export const STAGE_ORDER: readonly Stage[] = ["GROUP", "R32", "R16", "QF", "SF", "FINAL"];

export function stageOf(matchNo: number): Stage | null {
  if (!Number.isInteger(matchNo)) return null;
  if (matchNo >= 1 && matchNo <= 72) return "GROUP";
  if (matchNo >= 73 && matchNo <= 88) return "R32";
  if (matchNo >= 89 && matchNo <= 96) return "R16";
  if (matchNo >= 97 && matchNo <= 100) return "QF";
  if (matchNo === 101 || matchNo === 102) return "SF";
  if (matchNo === 104) return "FINAL";
  return null; // 103 (bronze) and anything out of range — unscored
}
