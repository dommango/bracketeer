export interface MatchCardProps {
  /** Internal match number 1–104. Used as the small caption. */
  matchNo: number;
  /** Round label, e.g. "Round of 32". */
  round?: string;
  /** Kickoff date label, e.g. "Sat Jun 27 · 15:00 ET". */
  kickoff?: string;
  /** Status drives the right-hand chip: `upcoming`, `live`, `final`. */
  status?: "upcoming" | "live" | "final";
  /** Live minute for `status="live"`. */
  minute?: number;
  /** Optional host-city accent — e.g. `"city-philadelphia"`. */
  accent?: string;
  /** Home team props passed to TeamRow. */
  home: { name: string; code?: string; score?: number | null; flag?: string };
  /** Away team props passed to TeamRow. */
  away: { name: string; code?: string; score?: number | null; flag?: string };
  /** Winner code, if decided. */
  winnerCode?: string | null;
  /** Pick state — what the user predicted. Used to colour the user-pick chip. */
  pickedCode?: string | null;
  /** Points the user earned on this match. */
  pointsEarned?: number | null;
}

export function MatchCard(props: MatchCardProps): JSX.Element;
