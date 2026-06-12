export interface TeamRowProps {
  /** Display name, e.g. "Brazil". */
  name: string;
  /** Three-letter code, e.g. "BRA". */
  code?: string;
  /** Match score (rendered right-aligned, tabular). */
  score?: number | null;
  /** This side is the decided winner — bolds + leaves loser at 40% opacity. */
  isWinner?: boolean;
  /** Decided but this side lost — dims to 40%. */
  isLoser?: boolean;
  /** Emoji flag glyph (e.g. "🇧🇷"). Optional. */
  flag?: string;
  /** Click to select this team as the advancer in pick mode. */
  onPick?: () => void;
  /** Render in pick-mode (large hit target, hover affordance). */
  pickable?: boolean;
  /** This team is the user's current pick. */
  picked?: boolean;
}

export function TeamRow(props: TeamRowProps): JSX.Element;
