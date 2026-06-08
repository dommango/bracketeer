// Bridge from the sports provider's identifiers to ours. Both maps are
// intentionally EMPTY until the real 2026 draw and fixture list exist — with
// empty maps the poller fetches but applies nothing, so manual entry stays the
// source of truth. Populate these once fixtures are published.
//
// Knockouts: map the SLOT (our internal match number 73–104), not the teams —
// the teams aren't known until the groups resolve. The winner is then derived
// from the live score plus EXTERNAL_TEAM_CODES.

// provider fixture id (string) -> internal match number
export const EXTERNAL_TO_MATCHNO: Record<string, number> = {};

// provider team id (string) -> our 3-letter team code (e.g. "MEX")
export const EXTERNAL_TEAM_CODES: Record<string, string> = {};
