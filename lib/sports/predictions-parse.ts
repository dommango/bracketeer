// Pure parser for API-Football's /predictions response — no env/network, so it's
// unit-tested directly. The fetch wrapper in client.ts binds it to env + network.

export interface H2HSummary {
  played: number;
  homeWins: number; // wins for the CURRENT fixture's home team across past meetings
  awayWins: number;
  draws: number;
}

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
  for (const f of list) {
    const gh = f.goals?.home;
    const ga = f.goals?.away;
    if (gh == null || ga == null) continue; // unplayed/abandoned
    if (gh === ga) {
      draws++;
      played++;
      continue;
    }
    // Only count results we can attribute to one of the two current teams, so
    // played always equals homeWins + awayWins + draws (a stray third team id —
    // rare in a messy h2h list — is ignored rather than skewing the total).
    const winnerId = gh > ga ? f.teams?.home?.id : f.teams?.away?.id;
    if (winnerId === homeId) {
      homeWins++;
      played++;
    } else if (winnerId === awayId) {
      awayWins++;
      played++;
    }
  }
  return played === 0 ? null : { played, homeWins, awayWins, draws };
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
