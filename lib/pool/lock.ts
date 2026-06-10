// Single source of truth for whether a member's picks can still be edited.
// Picks lock at kickoff (the tournament's startsAt) or when an admin has
// explicitly locked an entry. Both the submit guard and the UI use this.
export function arePicksLocked(
  startsAt: Date,
  entryLocked = false,
  now: Date = new Date(),
): boolean {
  return entryLocked || now.getTime() >= startsAt.getTime();
}
