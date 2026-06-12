export interface LeaderboardRowProps {
  rank: number;
  /** Display name. */
  label: string;
  /** Total points. */
  total: number;
  /** Optional live-projection delta from current matches. */
  projected?: number;
  /** Top-3 medal styling. */
  isLeader?: boolean;
  /** Highlight as the current user. */
  isYou?: boolean;
  /** Per-category breakdown chips. Order is preserved. */
  breakdown?: Array<{ label: string; value: number }>;
  /** Single-letter / two-letter avatar initials. */
  initials?: string;
  /** Host-city color token for the avatar (e.g. "city-houston"). */
  avatarColor?: string;
}

export function LeaderboardRow(props: LeaderboardRowProps): JSX.Element;
