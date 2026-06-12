export interface PickSelectorProps {
  /** Match label, e.g. "Brazil vs Argentina". */
  title?: string;
  /** Optional kickoff caption. */
  kickoff?: string;
  /** Round / match number caption. */
  caption?: string;
  /** Two options the user can tap to advance one. */
  options: Array<{
    code: string;
    name: string;
    flag?: string;
  }>;
  /** Currently-picked code. */
  value?: string | null;
  /** Callback when the user picks a code. */
  onPick: (code: string) => void;
}

export function PickSelector(props: PickSelectorProps): JSX.Element;
