export interface GroupChipProps {
  /** Group letter A-L. */
  group: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";
  size?: "sm" | "md" | "lg";
}

export function GroupChip(props: GroupChipProps): JSX.Element;
