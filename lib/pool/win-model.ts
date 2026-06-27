// Pure advancement model for the real knockout bracket: for every knockout match,
// the probability that each still-alive team is the one who advances out of it.
// Env-free + unit-tested; the DB/odds glue lives in queries.ts.
//
// Two market signals anchor the model, exactly the two the feature is asked to use:
//   • Round-of-32 match odds (MatchOdds) give a real head-to-head win probability
//     for the one round whose pairings are already known.
//   • Champion outrights (TeamOutright) give each team's probability of winning the
//     whole thing — i.e. of advancing out of the Final.
// Between those anchors we interpolate geometrically: a team that wins its R32 match
// with probability w and is champion with probability c is modelled as winning each
// later round with a constant per-match probability g, where w·g⁴ = c (four wins —
// R16, QF, SF, Final — separate the two anchors). So its probability of advancing
// out of a match d rounds past the R32 is w·gᵈ, and at the Final (d = 4) that is
// exactly c, reconciling the two sources. This is a deliberately simple,
// opponent-independent ("constant team strength") approximation — see the PR notes.
//
// The model conditions on results already in the answer key: a decided match
// collapses to its actual winner (probability 1), and eliminated teams drop out of
// every deeper round, so the projection stays correct as the bracket plays out.

import { R16, QF, SF, FINAL } from "@/lib/scoring/data";

// Knockout match ids, by round. Bronze (103) is intentionally excluded — it is not
// scored, so it never enters the projection (mirrors lib/scoring/score.ts).
const FINAL_ID = FINAL.id; // 104

// Feeder matches for every non-R32 knockout match (id -> its two feeder match ids).
const FEEDERS: Record<number, [number, number]> = (() => {
  const out: Record<number, [number, number]> = {};
  for (const m of [...R16, ...QF, ...SF, FINAL]) out[m.id] = [m.a, m.b];
  return out;
})();

// Rounds past the Round-of-32 (R32 = 0, R16 = 1, QF = 2, SF = 3, Final = 4). The
// exponent on g, and the only place round membership is encoded for the model.
export function knockoutDepth(matchId: number): number | null {
  if (matchId >= 73 && matchId <= 88) return 0;
  if (matchId >= 89 && matchId <= 96) return 1;
  if (matchId >= 97 && matchId <= 100) return 2;
  if (matchId === 101 || matchId === 102) return 3;
  if (matchId === FINAL_ID) return 4;
  return null; // group (≤72) or bronze (103) — not part of the knockout projection
}

// One R32 match's resolved teams and (draw-inclusive, home-oriented) implied probs.
export interface R32MatchInput {
  matchId: number; // 73..88
  homeCode: string | null;
  awayCode: string | null;
  homeWinProb: number | null;
  drawProb: number | null;
  awayWinProb: number | null;
}

export interface WinModelInput {
  r32: R32MatchInput[];
  outrights: Record<string, number>; // teamCode -> implied champion probability
  decided: Record<number, string>; // matchId -> recorded winner code (answer key so far)
}

export interface WinModel {
  // advance[matchId][teamCode] = P(team advances out of matchId). Teams with no
  // usable market signal are absent (treat as 0). Decided matches collapse to {winner:1}.
  advance: Record<number, Record<string, number>>;
  hasData: boolean; // false when no team has a usable signal — caller should no-op
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// Per-round win probability for a team that has reached a match but carries no
// market signal of its own. This only arises once results land: a decided match
// can promote a team with no odds/outright into a later round, and we still want
// to project its remaining path rather than drop it (which would zero an entry's
// EV for correctly picking a guaranteed advancer). A coin flip is the least-biased
// "we don't know" estimate. Never reached pre-knockout, when every team in an
// advance map is one the model already priced.
const NEUTRAL_PER_ROUND = 0.5;

// Two-way (draw-excluded) home win probability — knockout ties always produce a
// winner, so the draw share is removed and the pair renormalized. Null when the
// implied probs aren't usable (missing / not summing to ~1).
function twoWayHomeProb(o: R32MatchInput): number | null {
  if (o.homeWinProb == null || o.drawProb == null || o.awayWinProb == null) return null;
  if (o.homeWinProb < 0 || o.drawProb < 0 || o.awayWinProb < 0) return null;
  const sum = o.homeWinProb + o.drawProb + o.awayWinProb;
  if (sum <= 0.99 || sum >= 1.01) return null;
  const twoWay = o.homeWinProb + o.awayWinProb;
  if (twoWay <= 0) return null;
  return o.homeWinProb / twoWay;
}

// Per-team model: probability of winning its R32 match, and the constant per-match
// win probability g used for every later round. Null when neither signal exists.
interface TeamModel {
  winR32: number; // P(win the R32 match)
  g: number; // P(win each subsequent round), opponent-independent
}

function deriveTeamModel(winR32: number | undefined, outright: number | undefined): TeamModel | null {
  const hasW = winR32 != null && winR32 > 0;
  const hasC = outright != null && outright > 0;
  if (hasW && hasC) {
    // w·g⁴ = c ⇒ g = (c/w)^(1/4); clamp guards data noise (c > w would give g > 1).
    return { winR32: clamp01(winR32!), g: clamp01(Math.pow(outright! / winR32!, 0.25)) };
  }
  if (hasW) {
    // No champion price: assume the R32 win probability holds for later rounds too.
    return { winR32: clamp01(winR32!), g: clamp01(winR32!) };
  }
  if (hasC) {
    // No R32 price: champion = five straight wins (R32→Final), so q = c^(1/5) per round.
    const q = clamp01(Math.pow(outright!, 0.2));
    return { winR32: q, g: q };
  }
  return null;
}

export function buildWinModel(input: WinModelInput): WinModel {
  // Per-team R32 win probability (two-way) keyed by team code.
  const r32Win: Record<string, number> = {};
  const r32Participants: Record<number, [string | null, string | null]> = {};
  for (const m of input.r32) {
    r32Participants[m.matchId] = [m.homeCode, m.awayCode];
    const pHome = twoWayHomeProb(m);
    if (pHome == null) continue;
    if (m.homeCode) r32Win[m.homeCode] = pHome;
    if (m.awayCode) r32Win[m.awayCode] = 1 - pHome;
  }

  // Per-team interpolated model. Absent ⇒ no signal ⇒ contributes nothing.
  const teamModel: Record<string, TeamModel> = {};
  const teams = new Set<string>([...Object.keys(r32Win), ...Object.keys(input.outrights)]);
  for (const code of teams) {
    const tm = deriveTeamModel(r32Win[code], input.outrights[code]);
    if (tm) teamModel[code] = tm;
  }

  const advance: Record<number, Record<string, number>> = {};

  // R32 (depth 0): the two participants, conditioned on a decided result.
  for (const m of input.r32) {
    const dist: Record<string, number> = {};
    const winner = input.decided[m.matchId];
    if (winner) {
      dist[winner] = 1;
    } else {
      for (const code of [m.homeCode, m.awayCode]) {
        if (code && teamModel[code]) dist[code] = teamModel[code].winR32;
      }
    }
    advance[m.matchId] = dist;
  }

  // Later rounds (depth 1..4), bottom-up: a team's chance of advancing out of a
  // match is its chance of having reached it (advancing out of the feeder it came
  // through) times its constant per-match win probability g. Decided matches
  // collapse to their actual winner.
  for (const m of [...R16, ...QF, ...SF, FINAL]) {
    const dist: Record<string, number> = {};
    const winner = input.decided[m.id];
    if (winner) {
      dist[winner] = 1;
    } else {
      const [fa, fb] = FEEDERS[m.id];
      for (const feeder of [fa, fb]) {
        const reach = advance[feeder] ?? {};
        for (const [code, reachProb] of Object.entries(reach)) {
          // A team only reaches here via the model (priced) or a decided result
          // (certain advancer, possibly unpriced) — keep both, falling back to a
          // neutral per-round chance for the latter rather than dropping it.
          const g = teamModel[code]?.g ?? NEUTRAL_PER_ROUND;
          dist[code] = reachProb * g;
        }
      }
    }
    advance[m.id] = dist;
  }

  return { advance, hasData: Object.keys(teamModel).length > 0 };
}
