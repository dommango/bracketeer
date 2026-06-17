// Pure parser for API-Football's /predictions response — no env/network, so it's
// unit-tested directly. The fetch wrapper in client.ts binds it to env + network.

// One past meeting between the two fixture teams, with goals oriented to the
// CURRENT fixture's home/away (so home/awayGoals always read "this match's home
// team" regardless of who hosted that day).
export interface H2HMeeting {
  date: string | null; // ISO date of the meeting, if the provider gave one
  homeGoals: number;
  awayGoals: number;
  outcome: "home" | "away" | "draw"; // from the current home team's perspective
}

export interface H2HSummary {
  played: number;
  homeWins: number; // wins for the CURRENT fixture's home team across past meetings
  awayWins: number;
  draws: number;
  meetings: H2HMeeting[]; // most recent first, capped
}

const MAX_MEETINGS = 5;

export interface PredictionInsight {
  homePercent: number | null; // model-implied %, 0–100
  drawPercent: number | null;
  awayPercent: number | null;
  advice: string | null;
  homeForm: string | null; // last-5 form, e.g. "WWDLW"
  awayForm: string | null;
  h2h: H2HSummary | null;
}

// The slice of the /predictions response we read (one array entry).
export interface ApiPredictionResponse {
  predictions?: {
    advice?: string | null;
    percent?: { home?: string | null; draw?: string | null; away?: string | null };
  };
  teams?: {
    home?: { id?: number | null; last_5?: { form?: string | null } | null };
    away?: { id?: number | null; last_5?: { form?: string | null } | null };
  };
  h2h?: Array<{
    fixture?: { date?: string | null };
    teams?: { home?: { id?: number | null }; away?: { id?: number | null } };
    goals?: { home?: number | null; away?: number | null };
  }>;
}

// "45%" → 45; missing/garbage → null. Clamped to 0–100 so a bad provider value
// can't overflow the percentage bar or print "150%".
function pct(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace("%", "").trim(), 10);
  return Number.isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

// Tally past meetings relative to the CURRENT fixture's home/away team ids (each
// past fixture has its own home/away, so we map by team id, not by position).
function summarizeH2H(
  list: NonNullable<ApiPredictionResponse["h2h"]>,
  homeId: number | null,
  awayId: number | null,
): H2HSummary | null {
  if (homeId == null || awayId == null) return null;
  let played = 0,
    homeWins = 0,
    awayWins = 0,
    draws = 0;
  const meetings: H2HMeeting[] = [];
  for (const f of list) {
    const gh = f.goals?.home;
    const ga = f.goals?.away;
    if (gh == null || ga == null) continue; // unplayed/abandoned

    // Orient this meeting's goals to the current fixture's home/away. Skip any
    // entry that isn't cleanly between the two current teams.
    const entryHome = f.teams?.home?.id;
    const entryAway = f.teams?.away?.id;
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    if (entryHome === homeId && entryAway === awayId) {
      homeGoals = gh;
      awayGoals = ga;
    } else if (entryHome === awayId && entryAway === homeId) {
      homeGoals = ga;
      awayGoals = gh;
    }

    if (gh === ga) {
      draws++;
      played++;
    } else {
      // Tally by team id, so played always equals homeWins + awayWins + draws (a
      // stray third team id — rare in a messy list — is ignored, not skewed in).
      const winnerId: number | null | undefined = gh > ga ? entryHome : entryAway;
      if (winnerId === homeId) {
        homeWins++;
        played++;
      } else if (winnerId === awayId) {
        awayWins++;
        played++;
      }
    }

    if (homeGoals != null && awayGoals != null) {
      meetings.push({
        date: f.fixture?.date ?? null,
        homeGoals,
        awayGoals,
        outcome: homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw",
      });
    }
  }
  if (played === 0) return null;

  // Most recent first when dates are present; dateless entries keep provider order.
  meetings.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { played, homeWins, awayWins, draws, meetings: meetings.slice(0, MAX_MEETINGS) };
}

export function parsePrediction(resp: ApiPredictionResponse): PredictionInsight {
  const p = resp.predictions ?? {};
  const homeId = resp.teams?.home?.id ?? null;
  const awayId = resp.teams?.away?.id ?? null;
  return {
    homePercent: pct(p.percent?.home),
    drawPercent: pct(p.percent?.draw),
    awayPercent: pct(p.percent?.away),
    advice: p.advice?.trim() || null,
    homeForm: resp.teams?.home?.last_5?.form ?? null,
    awayForm: resp.teams?.away?.last_5?.form ?? null,
    h2h: summarizeH2H(resp.h2h ?? [], homeId, awayId),
  };
}
