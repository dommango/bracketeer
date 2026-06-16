// Best-effort match of a bookmaker's player name (e.g. "K. Mbappé") to a stats-board
// entry (e.g. "Kylian Mbappé") so the Golden-Boot odds can borrow a team code for a
// flag. Pure + env-free, so the "never a wrong flag" invariant is unit-tested.
// Exact normalized match wins; failing that, an *unambiguous* surname match. Anything
// ambiguous (a surname shared across teams) or unmatched returns null — never a guess.

export interface BoardPlayer {
  playerName: string;
  teamCode: string;
}

// Lowercase, strip combining diacritics, collapse dots/spaces — so "K. Mbappé" and
// "Kylian Mbappé" share a comparable form.
export function normPlayer(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.\s]+/g, " ")
    .trim();
}

const surnameOf = (norm: string): string => {
  const tokens = norm.split(" ").filter(Boolean);
  return tokens[tokens.length - 1] ?? "";
};

export function matchPlayerCode(oddsName: string, board: BoardPlayer[]): string | null {
  const target = normPlayer(oddsName);
  if (!target) return null;

  // 1) Exact normalized name.
  for (const b of board) {
    if (normPlayer(b.playerName) === target) return b.teamCode;
  }

  // 2) Unambiguous surname match: accept only when every board player sharing the
  // surname is on the same team (so a shared "Silva" across teams stays null).
  const sn = surnameOf(target);
  if (!sn) return null;
  const codes = new Set<string>();
  for (const b of board) {
    if (surnameOf(normPlayer(b.playerName)) === sn) codes.add(b.teamCode);
  }
  return codes.size === 1 ? [...codes][0] : null;
}
