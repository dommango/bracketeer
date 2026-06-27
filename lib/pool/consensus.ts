// Pure overlay of the prediction model's win % against the pool's own pick-split
// for a knockout match: who does the API-Football model favor, who did the pool
// back, and do they agree? Env-free + unit-tested; the match-detail page composes
// it from data the query already returns (MatchDetail.prediction + pickSplit) and
// renders nothing when either side is absent.

export interface ConsensusInput {
  homeCode: string | null;
  awayCode: string | null;
  homeName: string;
  awayName: string;
  modelHomePct: number | null; // model win % (0..100), draw-inclusive
  modelAwayPct: number | null;
  poolHomePct: number; // pool backing % (0..100) from the pick-split
  poolAwayPct: number;
  poolOtherPct: number; // share whose bracket sent a different team to this slot
}

export interface ConsensusSide {
  code: string;
  name: string;
  modelPct: number; // model win % (0..100)
  poolPct: number; // share of pool winner-picks (0..100)
}

export interface Consensus {
  home: ConsensusSide;
  away: ConsensusSide;
  modelFavorite: ConsensusSide; // higher model %; ties resolve to home
  poolFavorite: ConsensusSide; // higher of the two real teams; ties resolve to home
  agree: boolean; // model + pool favor the same team
  // True when the pick-split's "other" slice is the plurality — most of the pool
  // bracketed neither of the two teams actually playing here (common in early
  // knockout rounds, where brackets diverged on who reaches this slot). In that
  // case `poolFavorite` is a minority of the pool and the consumer should say so
  // rather than claim the pool "leaned" a single-digit share.
  poolDivided: boolean;
  poolOtherPct: number; // the "other" share, carried through for that copy
  // Signed gap for the model favorite: poolPct − modelPct (in percentage points).
  // Positive ⇒ the pool backs the model's pick even harder than the model does;
  // negative ⇒ the pool is cooler on it than the model.
  gap: number;
}

// Returns null (render nothing) when either team is unresolved or the model has
// no win percentages yet — graceful degradation, matching the sibling panels.
export function buildConsensus(input: ConsensusInput): Consensus | null {
  if (!input.homeCode || !input.awayCode) return null;
  if (input.modelHomePct == null || input.modelAwayPct == null) return null;

  const home: ConsensusSide = {
    code: input.homeCode,
    name: input.homeName,
    modelPct: input.modelHomePct,
    poolPct: input.poolHomePct,
  };
  const away: ConsensusSide = {
    code: input.awayCode,
    name: input.awayName,
    modelPct: input.modelAwayPct,
    poolPct: input.poolAwayPct,
  };

  const modelFavorite = home.modelPct >= away.modelPct ? home : away;
  const poolFavorite = home.poolPct >= away.poolPct ? home : away;
  const agree = modelFavorite.code === poolFavorite.code;
  const gap = modelFavorite.poolPct - modelFavorite.modelPct;
  const poolDivided =
    input.poolOtherPct > 0 &&
    input.poolOtherPct >= home.poolPct &&
    input.poolOtherPct >= away.poolPct;

  return { home, away, modelFavorite, poolFavorite, agree, poolDivided, poolOtherPct: input.poolOtherPct, gap };
}
