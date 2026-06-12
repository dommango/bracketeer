export interface CardProps {
  /** `flat` is the default; `raised` adds a soft shadow; `brand` is the pitch-green hero panel; `sunk` is the inset surface. */
  variant?: "flat" | "raised" | "brand" | "sunk" | "dashed";
  /** Padding scale. */
  padding?: "none" | "sm" | "md" | "lg";
  /** Roundness. Defaults to `lg` (16px). */
  radius?: "md" | "lg" | "xl" | "2xl";
  /** Tint the left edge with a host-city accent color (CSS custom property name without var()). */
  accent?: string;
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function Card(props: CardProps): JSX.Element;
