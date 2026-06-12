export interface BracketTreeMatch {
  matchNo: number;
  /** Optional kickoff caption. */
  kickoff?: string;
  /** "live" | "upcoming" | "final". */
  status?: "upcoming" | "live" | "final";
  minute?: number;
  home: { name: string; code?: string };
  away: { name: string; code?: string };
  homeScore?: number | null;
  awayScore?: number | null;
  winnerCode?: string | null;
  /** This match was a user pick — the picked side highlights. */
  pickedCode?: string | null;
}

export interface BracketTreeProps {
  /** Each key is the round id; values are the matches in bracket order. */
  rounds: {
    r32: BracketTreeMatch[];
    r16: BracketTreeMatch[];
    qf: BracketTreeMatch[];
    sf: BracketTreeMatch[];
    final: BracketTreeMatch[];
  };
  /** Optional bronze (3rd place) match — rendered as a small card below the Final. */
  bronze?: BracketTreeMatch;
  /** Card width in px. Default 200. */
  cardWidth?: number;
  /** Card height in px. Default 64. */
  cardHeight?: number;
  /** Vertical padding around the tree. Default 24. */
  pad?: number;
  /** Column width (incl. connector gutter). Default 240. */
  colWidth?: number;
}

export function BracketTree(props: BracketTreeProps): JSX.Element;
