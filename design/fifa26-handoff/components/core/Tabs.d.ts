export interface TabsProps {
  /** Array of `[id, label]` pairs. */
  items: Array<[string, string]>;
  /** Currently-active id. */
  value: string;
  onChange: (id: string) => void;
  /** Pill style or underline style. Pills are the default. */
  variant?: "pill" | "underline";
}

export function Tabs(props: TabsProps): JSX.Element;
