export interface PoolHeroProps {
  /** Top eyebrow line ("FIFA WORLD CUP 2026"). */
  eyebrow?: string;
  /** Main title, e.g. pool name. */
  title: string;
  /** Subtitle / supporting copy. */
  subtitle?: string;
  /** Big metric block — shows on the right, e.g. join code. */
  metric?: { label: string; value: string };
  /** Render the official 26 pattern in the background. */
  pattern?: boolean;
  /** Pattern asset path (defaults to ../../assets/brand-26-pattern.avif). */
  patternSrc?: string;
  /** Status pill: `upcoming`, `live`, `final`. */
  status?: "upcoming" | "live" | "final";
  /** Bottom row of children — buttons, badges. */
  actions?: React.ReactNode;
}

export function PoolHero(props: PoolHeroProps): JSX.Element;
