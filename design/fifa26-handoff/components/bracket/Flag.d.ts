/**
 * Map team code → ISO 3166-1 alpha-2 country code (used by flagcdn.com).
 * The 48 World Cup 26 qualifiers; the few special cases (Scotland, England)
 * use the GB-* subdivision codes that flagcdn supports.
 */
export const TEAM_TO_ISO2: Record<string, string>;

export interface FlagProps {
  /** 3-letter team code, e.g. "BRA". */
  code: string;
  /** Pixel size of the (square) flag tile. */
  size?: number;
  /** `circle` clips to a round chip, `rect` leaves the natural ratio,
   *  `square` covers a square hit area (default). */
  shape?: "square" | "circle" | "rect";
  /** Add a 1px subtle hairline. */
  bordered?: boolean;
  /** Override the CDN URL builder (defaults to flagcdn.com SVG). */
  src?: (iso2: string) => string;
  /** Inline alt label (defaults to the team code). */
  alt?: string;
}

export function Flag(props: FlagProps): JSX.Element;
