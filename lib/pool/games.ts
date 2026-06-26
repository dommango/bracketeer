// Single source of truth for game-facing copy and a pure, time-derived phase for
// each game format. Every hub / create / pool surface that needs to describe a
// game or its current state reads from here, so the three games' stories can't
// drift across ~10 files. Pure and dependency-light: it wraps the fixed schedule
// constants (lib/scoring/schedule, lib/pool/knockout, lib/pool/match-day-3) and
// never touches the DB. The one thing it can't know purely — whether the
// full-bracket tournament has actually started — stays gated by the DB-backed
// hasTournamentStarted() at the call site, exactly as before.

import type { PoolFormat } from "@/lib/pool/manage";
import { KNOCKOUT_PICKS_OPEN_UTC } from "@/lib/pool/knockout";
import { firstMd3Kickoff, lastMd3Kickoff } from "@/lib/pool/match-day-3";
import { kickoffFor } from "@/lib/scoring/schedule";
import { PRIZES, isChallengeFormat } from "@/lib/challenge/prizes-config";
import { formatPrize } from "@/lib/challenge/format-prize";

export interface GameCatalogEntry {
  // The game's display name as a closed/private pool (e.g. "Knockout Stage Pool").
  // Undefined for formats that only exist as a public challenge (Match Day Pickem).
  poolName?: string;
  // The game's display name as a public challenge (e.g. "Knockout Challenge").
  // Undefined for formats with no public challenge (Full Tournament Pool).
  challengeName?: string;
  // A one-line hook shown under the name on cards / banners.
  tagline: string;
  // A fuller description for the create page + card body.
  blurb: string;
  // A terse scoring summary line.
  scoringSummary: string;
}

// Every user-facing game string in one place. The same KNOCKOUT format reads as a
// "Knockout Stage Pool" when it's a private pool and a "Knockout Challenge" on the
// public board, so names are split by context (poolName / challengeName). Pulled
// from copy previously inlined across CreatePoolForm, create/page, KnockoutNotice,
// the challenge pages and the prize resolver so those surfaces can't drift.
export const GAME_CATALOG: Record<PoolFormat, GameCatalogEntry> = {
  MATCH_DAY_3_PICKEM: {
    challengeName: "Match Day Pickem",
    tagline: "Predict the score lines for the Match Day 3 games (June 24–27).",
    blurb:
      "Predict the exact scoreline of every final group-stage match. Each pick locks at its own kickoff, so later fixtures stay open after earlier ones start.",
    scoringSummary: "Exact score 5 · right result & goal difference 3 · right result 1.",
  },
  KNOCKOUT: {
    poolName: "Knockout Stage Pool",
    challengeName: "Knockout Challenge",
    tagline: "Create & invite now — picks open when the last 32 are set.",
    blurb:
      "Predict the knockout bracket against your friends. Create your pool and invite everyone now with the join code — picks open once the group stage wraps and the last 32 are set, then lock at the Round of 32 kickoff.",
    scoringSummary: "Round of 32 1 · R16 2 · QF 3 · SF 4 · Final 5.",
  },
  FULL_BRACKET: {
    poolName: "Full Tournament Pool",
    tagline: "The full tournament — group stage through the final.",
    blurb:
      "The full tournament — group stage through the final. Import or fill out the whole bracket. Only creatable before the group stage kicks off.",
    scoringSummary: "Group, third-place, and every knockout round are scored.",
  },
};

// Phases a game moves through over its lifecycle. UPCOMING = not yet creatable or
// open; CREATE_ONLY = you can create/invite but picks are gated shut (knockout
// before the field is set); PICKS_OPEN / PICKS_CLOSING = picks editable, the
// latter once the first lock has passed; LOCKED_LIVE = all picks locked, game
// playing out; COMPLETE = nothing left to do.
export type GamePhase =
  | "UPCOMING"
  | "CREATE_ONLY"
  | "PICKS_OPEN"
  | "PICKS_CLOSING"
  | "LOCKED_LIVE"
  | "COMPLETE";

export interface GameState {
  phase: GamePhase;
  // A short human label for the phase (badge / state line text).
  label: string;
  // The next meaningful deadline (first lock, lock, or open time), or null.
  deadline: Date | null;
  // Whether a new pool of this format can be created right now. For FULL_BRACKET
  // this is only an upper bound — the caller still AND-gates on the DB-backed
  // hasTournamentStarted(); see module header.
  creatable: boolean;
  // Whether the game accepts new joiners with something still to play for.
  joinable: boolean;
}

// Fixed schedule anchors, derived once. MD3 first/last lock are the kickoffs of
// the earliest/latest round-3 fixtures; knockout open is the fixed constant and
// its lock is the Round-of-32 kickoff (match 73).
const MD3_FIRST_LOCK = firstMd3Kickoff();
const MD3_LAST_LOCK = lastMd3Kickoff();
const KNOCKOUT_OPEN = new Date(KNOCKOUT_PICKS_OPEN_UTC);
const KNOCKOUT_LOCK = kickoffFor(73) ?? new Date(KNOCKOUT_PICKS_OPEN_UTC);
const FULL_START = kickoffFor(1) ?? new Date("2026-06-11T19:00:00Z");

// Pure, time-derived phase for a game. No DB — every boundary is a fixed instant.
export function resolveGamePhase(format: PoolFormat, now: Date = new Date()): GameState {
  const t = now.getTime();

  if (format === "MATCH_DAY_3_PICKEM") {
    if (t < MD3_FIRST_LOCK.getTime()) {
      return {
        phase: "PICKS_OPEN",
        label: "Open now",
        deadline: MD3_FIRST_LOCK,
        creatable: true,
        joinable: true,
      };
    }
    if (t < MD3_LAST_LOCK.getTime()) {
      return {
        phase: "PICKS_CLOSING",
        label: "Closing — some fixtures locked",
        deadline: MD3_LAST_LOCK,
        creatable: true,
        joinable: true,
      };
    }
    return {
      phase: "LOCKED_LIVE",
      label: "Locked · live",
      deadline: null,
      creatable: false,
      joinable: false,
    };
  }

  if (format === "KNOCKOUT") {
    if (t < KNOCKOUT_OPEN.getTime()) {
      return {
        phase: "CREATE_ONLY",
        label: "Opens Jun 28",
        deadline: KNOCKOUT_OPEN,
        creatable: true,
        joinable: true,
      };
    }
    if (t < KNOCKOUT_LOCK.getTime()) {
      return {
        phase: "PICKS_OPEN",
        label: "Picks open",
        deadline: KNOCKOUT_LOCK,
        creatable: true,
        joinable: true,
      };
    }
    return {
      phase: "LOCKED_LIVE",
      label: "Locked · live",
      deadline: null,
      creatable: false,
      joinable: false,
    };
  }

  // FULL_BRACKET: creatable only before the group stage kicks off; after that it's
  // locked and live. (creatable here is the time upper bound; the caller still
  // confirms via hasTournamentStarted().)
  if (t < FULL_START.getTime()) {
    return {
      phase: "UPCOMING",
      label: "Picks open",
      deadline: FULL_START,
      creatable: true,
      joinable: true,
    };
  }
  return {
    phase: "LOCKED_LIVE",
    label: "Locked · live",
    deadline: null,
    creatable: false,
    joinable: false,
  };
}

// Which single game the hub should spotlight right now, or null when there's
// nothing to promote (everything is live / leaderboards-only). MD3 while it's
// still joinable; otherwise the Knockout Challenge once its picks are open. The
// gap between the last MD3 lock and knockout open spotlights nothing (the banner
// renders a "Knockout opens soon" teaser separately via resolveGamePhase).
export function featuredGame(now: Date = new Date()): PoolFormat | null {
  if (resolveGamePhase("MATCH_DAY_3_PICKEM", now).joinable) return "MATCH_DAY_3_PICKEM";
  if (resolveGamePhase("KNOCKOUT", now).phase === "PICKS_OPEN") return "KNOCKOUT";
  return null;
}

// The headline prize teaser for a challenge format. Null for formats without a
// prize (the amount/award itself lives in PRIZES; copy stays deliberately generic).
export function prizeTeaser(format: PoolFormat): string | null {
  if (!isChallengeFormat(format)) return null;
  const prize = PRIZES[format];
  // Scaled prizes advertise the guaranteed floor ("$50+") so we never over-promise
  // a value that depends on the final entrant count; fixed prizes show their figure.
  if (prize.kind === "scaled") {
    return `Top the challenge — win a ${formatPrize(prize.min, prize.currency)}+ gift card (grows with entries).`;
  }
  return `Top the challenge — win ${prize.description}.`;
}

const MONTH_DAY = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function dayLabel(d: Date): string {
  return MONTH_DAY.format(d); // e.g. "24 Jun"
}

// The calendar span of the Match Day Pickem fixtures (first → last kickoff), for
// copy that tells players which games they're predicting and when. UTC-framed to
// match the rest of this module's date labels (gameStateLine). e.g. "24 – 28 Jun".
export function md3DateRange(): string {
  const first = dayLabel(firstMd3Kickoff());
  const last = dayLabel(lastMd3Kickoff());
  return first === last ? first : `${first} – ${last}`;
}

// A short, friendly state line for a game card / badge, derived from the phase.
// Single source so the create card, create-success copy and the pool notice can't
// drift. Examples: "Open now · first pick locks 24 Jun",
// "Create & invite now · picks open 28 Jun", "Closed — group stage kicked off".
export function gameStateLine(format: PoolFormat, now: Date = new Date()): string {
  const state = resolveGamePhase(format, now);

  if (format === "MATCH_DAY_3_PICKEM") {
    switch (state.phase) {
      case "PICKS_OPEN":
        return "Open now · picks close at the start of each match";
      case "PICKS_CLOSING":
        return "Open now · picks close at the start of each match";
      default:
        return "Closed — Match Day Pickem has finished";
    }
  }

  if (format === "KNOCKOUT") {
    switch (state.phase) {
      case "CREATE_ONLY":
        return state.deadline
          ? `Create & invite now · picks open ${dayLabel(state.deadline)}`
          : "Create & invite now · picks open at the draw";
      case "PICKS_OPEN":
        return "Picks open now · lock at the Round of 32 kickoff";
      default:
        return "Locked — the Round of 32 has kicked off";
    }
  }

  // FULL_BRACKET
  return state.phase === "UPCOMING"
    ? "Open now · locks at kickoff"
    : "Closed — the group stage has kicked off";
}
