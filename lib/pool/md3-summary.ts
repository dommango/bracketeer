// Single source for the Match Day Pickem progress line, shared by the challenge
// home and the play page. Splits the 24 fixtures into three buckets a late joiner
// can act on: predicted, still open (pickable now), and missed (kicked off with no
// pick). Zero buckets drop out so an early entrant just sees "24 open".

export interface Md3Counts {
  pickedCount: number;
  openCount: number;
  missedCount: number;
}

export function md3CountLine({ pickedCount, openCount, missedCount }: Md3Counts): string {
  const clauses: string[] = [];
  if (pickedCount > 0) clauses.push(`${pickedCount} predicted`);
  if (openCount > 0) clauses.push(`${openCount} open`);
  if (missedCount > 0) clauses.push(`${missedCount} missed`);
  // Nothing predicted, nothing open, nothing missed only happens with no fixtures
  // at all — fall back to a neutral zero state rather than an empty string.
  if (clauses.length === 0) return "0 open";
  return clauses.join(" · ");
}
