export interface ButtonProps {
  /** Visual style. `primary` = pitch-green filled, `secondary` = paper-outlined, `gold` = trophy gold (winning actions), `ghost` = transparent. */
  variant?: "primary" | "secondary" | "gold" | "ghost" | "danger";
  /** Size. `md` is the default for in-app buttons; `lg` is for the kickoff-lockout submit. */
  size?: "sm" | "md" | "lg";
  /** Render as a full-width block — used in mobile submission flows. */
  block?: boolean;
  /** Show a loading spinner and disable the button. */
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
