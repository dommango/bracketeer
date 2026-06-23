// Match Day 3 Pickem — prediction storage. Reuses the generic Entry/Pick tables
// (one Entry per user per MD3 pool) but with its own self-describing Pick-row
// convention, so it never goes through submissionToPickRows / the parity oracle.
//
// Two rows per fixture mirror the Pick column semantics (code = team, teamOrValue
// = value):
//   section="match_day_3"  category="M9"  key="home"  code=<homeCode>  teamOrValue="2"
//   section="match_day_3"  category="M9"  key="away"  code=<awayCode>  teamOrValue="1"
//
// Per-match lock is enforced on write: a fixture already kicked off keeps its
// stored pick and ignores any incoming change, so later fixtures stay editable
// after earlier ones lock.

import { prisma } from "@/lib/db";
import { md3Fixtures, isMd3MatchNo, isMd3MatchLocked, type ScoreLine } from "@/lib/pool/match-day-3";

const SECTION = "match_day_3";
const MAX_GOALS = 99;

export type Md3Scores = Record<number, ScoreLine>;

export interface Md3Entry {
  entryId: string;
  label: string;
  scores: Md3Scores;
  // Whether this entry is opted into the public MD3 challenge.
  enteredChallenge: boolean;
}

function category(matchNo: number): string {
  return `M${matchNo}`;
}

function clampGoals(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  if (n < 0 || n > MAX_GOALS) return null;
  return n;
}

// Decode a flat set of MD3 Pick rows into { matchNo: { home, away } }. Only
// fixtures with BOTH a home and away goal row count as a complete pick.
export function decodeMd3Rows(
  rows: { category: string; key: string; teamOrValue: string }[],
): Md3Scores {
  const partial = new Map<number, { home?: number; away?: number }>();
  for (const r of rows) {
    const matchNo = Number(r.category.replace(/^M/, ""));
    if (!isMd3MatchNo(matchNo)) continue;
    if (r.key !== "home" && r.key !== "away") continue;
    const goals = clampGoals(Number(r.teamOrValue));
    if (goals === null) continue;
    const cur = partial.get(matchNo) ?? {};
    cur[r.key] = goals;
    partial.set(matchNo, cur);
  }
  const scores: Md3Scores = {};
  for (const [matchNo, v] of partial) {
    if (typeof v.home === "number" && typeof v.away === "number") {
      scores[matchNo] = { home: v.home, away: v.away };
    }
  }
  return scores;
}

// Build the canonical Pick rows for a full set of scores, pulling each fixture's
// home/away team codes from md3Fixtures (server-authoritative orientation).
function rowsFor(scores: Md3Scores): { section: string; category: string; key: string; code: string; teamOrValue: string }[] {
  const byNo = new Map(md3Fixtures().map((f) => [f.matchNo, f]));
  const rows: { section: string; category: string; key: string; code: string; teamOrValue: string }[] = [];
  for (const [matchNoStr, line] of Object.entries(scores)) {
    const matchNo = Number(matchNoStr);
    const fixture = byNo.get(matchNo);
    if (!fixture) continue;
    const home = clampGoals(line.home);
    const away = clampGoals(line.away);
    if (home === null || away === null) continue;
    rows.push({ section: SECTION, category: category(matchNo), key: "home", code: fixture.homeCode, teamOrValue: String(home) });
    rows.push({ section: SECTION, category: category(matchNo), key: "away", code: fixture.awayCode, teamOrValue: String(away) });
  }
  return rows;
}

export interface UpsertMd3Result {
  entryId: string;
  written: number; // fixtures actually saved (open ones)
}

// Merge submitted scores over current ones honoring the per-match lock: a fixture
// already kicked off is frozen to its stored value; an open fixture takes the
// submitted value when present, else keeps the current one.
function mergeMd3Scores(current: Md3Scores, submitted: Md3Scores, now: Date): Md3Scores {
  const merged: Md3Scores = {};
  for (const f of md3Fixtures()) {
    const locked = isMd3MatchLocked(f.matchNo, now);
    const chosen = locked ? current[f.matchNo] : (submitted[f.matchNo] ?? current[f.matchNo]);
    if (chosen) merged[f.matchNo] = chosen;
  }
  return merged;
}

// The user's standalone MD3 entry for a tournament (poolId null), or null if they
// haven't built one. A standalone entry feeds the public challenge without a pool;
// it carries the same self-describing pick rows as a pooled MD3 entry.
export async function getStandaloneMd3Entry(
  tournamentId: string,
  userId: string,
): Promise<Md3Entry | null> {
  const entry = await prisma.entry.findFirst({
    where: { tournamentId, userId, poolId: null, format: "MATCH_DAY_3_PICKEM" },
    select: {
      id: true,
      label: true,
      enteredChallenge: true,
      picks: { select: { category: true, key: true, teamOrValue: true } },
    },
  });
  if (!entry) return null;
  return {
    entryId: entry.id,
    label: entry.label,
    scores: decodeMd3Rows(entry.picks),
    enteredChallenge: entry.enteredChallenge,
  };
}

export interface UpsertStandaloneMd3Input {
  tournamentId: string;
  userId: string;
  label: string;
  // matchNo → predicted scoreline. May be partial; only valid, unlocked MD3
  // fixtures are written (locked fixtures keep their stored value).
  scores: Md3Scores;
}

// Save a user's standalone MD3 predictions (one entry per user per tournament, no
// pool). Per-match lock via mergeMd3Scores — locked fixtures keep their stored
// value, open ones take the submission. Idempotent.
export async function upsertStandaloneMd3Picks(
  input: UpsertStandaloneMd3Input,
  now: Date = new Date(),
): Promise<UpsertMd3Result> {
  const label = input.label.trim() || "Participant";

  return prisma.$transaction(async (tx) => {
    const existing = await tx.entry.findFirst({
      where: {
        tournamentId: input.tournamentId,
        userId: input.userId,
        poolId: null,
        format: "MATCH_DAY_3_PICKEM",
      },
      select: { id: true, picks: { select: { category: true, key: true, teamOrValue: true } } },
    });

    const current: Md3Scores = existing ? decodeMd3Rows(existing.picks) : {};
    const merged = mergeMd3Scores(current, input.scores, now);
    const rows = rowsFor(merged);

    let entryId: string;
    if (existing) {
      entryId = existing.id;
      await tx.entry.update({ where: { id: entryId }, data: { label, importedFrom: "UI" } });
      await tx.pick.deleteMany({ where: { entryId } });
    } else {
      const entry = await tx.entry.create({
        data: {
          poolId: null,
          tournamentId: input.tournamentId,
          format: "MATCH_DAY_3_PICKEM",
          userId: input.userId,
          label,
          importedFrom: "UI",
        },
        select: { id: true },
      });
      entryId = entry.id;
    }
    if (rows.length > 0) {
      await tx.pick.createMany({ data: rows.map((r) => ({ ...r, entryId })) });
    }

    return { entryId, written: Object.keys(merged).length };
  });
}
