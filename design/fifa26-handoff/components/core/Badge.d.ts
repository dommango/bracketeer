export interface BadgeProps {
  /** Visual tone. `live` glows red and pulses; `gold` is the trophy/winner badge; `neutral` for inert labels. */
  tone?: "neutral" | "live" | "gold" | "positive" | "warning" | "negative" | "brand";
  /** `solid` is filled, `soft` uses the tinted variant, `outline` is the bordered chip. */
  variant?: "solid" | "soft" | "outline";
  size?: "sm" | "md";
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
