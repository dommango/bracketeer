import Link from "next/link";
import { GAME_CATALOG, resolveGamePhase, gameStateLine, prizeTeaser } from "@/lib/pool/games";
import { kickoffFor } from "@/lib/scoring/schedule";
import { R32Countdown } from "./pool/[code]/R32Countdown";

const PRIMARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.97]";
const SECONDARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-[18px] font-semibold text-pitch-dark transition-colors hover:bg-surface-sunk active:scale-[0.97]";

// Highlight pill flagging a game that's new this run, styled off the gold accent
// so it stands apart from the neutral phase badges.
function NewTag() {
  return (
    <span className="shrink-0 rounded-full bg-gold-dark px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      New
    </span>
  );
}

// Both public challenges (Match Day Pickem + Knockout Challenge) promoted side by
// side while either is relevant. Each card self-hides once its game is locked/done,
// so the section quietly empties out at the end of the group + knockout windows.
// Shared so the home hub and the sign-in panel promote the games identically.
export function PublicGames({ now }: { now: Date }) {
  const md3 = resolveGamePhase("MATCH_DAY_3_PICKEM", now);
  const ko = resolveGamePhase("KNOCKOUT", now);
  const md3Show = md3.phase === "PICKS_OPEN" || md3.phase === "PICKS_CLOSING";
  const koShow = ko.phase === "CREATE_ONLY" || ko.phase === "PICKS_OPEN";
  if (!md3Show && !koShow) return null;

  return (
    <section className="mt-4 space-y-2">
      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
        Play the public games
      </p>
      {md3Show ? <Md3PromoCard now={now} /> : null}
      {koShow ? <KnockoutChallengeCard now={now} /> : null}
    </section>
  );
}

// Match Day Pickem — the live group-stage scoreline game. Public challenge, so it's
// play / leaderboard rather than create / join.
function Md3PromoCard({ now }: { now: Date }) {
  const teaser = prizeTeaser("MATCH_DAY_3_PICKEM");
  return (
    <div className="rounded-3xl border border-pitch/30 bg-pitch/5 p-[22px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
          Live now · {GAME_CATALOG.MATCH_DAY_3_PICKEM.challengeName}
        </p>
        <NewTag />
      </div>
      <h2 className="mt-1 font-display text-xl text-ink">
        {GAME_CATALOG.MATCH_DAY_3_PICKEM.tagline}
      </h2>
      <p className="mt-1.5 text-[13px] font-semibold text-pitch-dark">
        {gameStateLine("MATCH_DAY_3_PICKEM", now)}
      </p>
      {teaser ? (
        <p className="mt-1 text-[13px] font-semibold text-gold-dark">🏆 {teaser}</p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/challenge/md3/play" className={PRIMARY_BTN}>
          Play
        </Link>
        <Link href="/challenge/md3/leaderboard" className={SECONDARY_BTN}>
          Leaderboard
        </Link>
      </div>
    </div>
  );
}

// Knockout Challenge — the public bracket game. "Build your bracket" lives only here
// (it's the Knockout Challenge submission, not a pool), with the Round-of-32 kickoff
// countdown so every surface that promotes the challenge shows the same clock.
function KnockoutChallengeCard({ now }: { now: Date }) {
  const open = resolveGamePhase("KNOCKOUT", now).phase === "PICKS_OPEN";
  const teaser = prizeTeaser("KNOCKOUT");
  const r32 = kickoffFor(73);
  return (
    <div className="rounded-3xl border border-gold/40 bg-gold-tint p-[22px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold-dark">
          {GAME_CATALOG.KNOCKOUT.challengeName}
        </p>
        <NewTag />
      </div>
      <h2 className="mt-1 font-display text-xl text-ink">
        Build your bracket and top the global leaderboard.
      </h2>
      <p className="mt-1.5 text-[13px] font-semibold text-pitch-dark">
        {open
          ? "Picks open now — lock at the Round of 32 kickoff."
          : "Opens June 28 — picks open once the last 32 are set."}
      </p>
      {teaser ? (
        <p className="mt-1 text-[13px] font-semibold text-gold-dark">🏆 {teaser}</p>
      ) : null}
      {r32 ? (
        <div className="mt-3">
          <R32Countdown target={r32.toISOString()} label="Round of 32 kicks off in" />
        </div>
      ) : null}
      <Link href="/bracket" className={`mt-3 ${PRIMARY_BTN}`}>
        Build your bracket →
      </Link>
    </div>
  );
}
