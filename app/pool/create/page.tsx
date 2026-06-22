import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { hasTournamentStarted } from "@/lib/pool/queries";
import type { PoolFormat } from "@/lib/pool/manage";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import {
  GAME_CATALOG,
  resolveGamePhase,
  featuredGame,
  gameStateLine,
  prizeTeaser,
} from "@/lib/pool/games";
import { CreatePoolForm, type GameCardVM } from "./CreatePoolForm";
import { Hero } from "../../Hero";

export const dynamic = "force-dynamic";

// Display order for the cards, featured game first so the most relevant option
// leads. featuredGame is null in the lull between games — fall back to the
// schedule's natural order (MD3 → Knockout → Full).
function orderedFormats(now: Date): PoolFormat[] {
  const base: PoolFormat[] = ["MATCH_DAY_3_PICKEM", "KNOCKOUT", "FULL_BRACKET"];
  const featured = featuredGame(now);
  if (!featured) return base;
  return [featured, ...base.filter((f) => f !== featured)];
}

export default async function CreatePoolPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const user = await getSessionUser();
  const { game } = await searchParams;
  const now = new Date();

  // Full-bracket creatability is the only flag that needs a DB read (whether the
  // tournament has actually kicked off); MD3/knockout are purely time-derived.
  const fullGameAvailable = !(await hasTournamentStarted());
  const md3Available = isMd3GameOpen(now);

  const isCreatable = (f: PoolFormat): boolean => {
    if (f === "FULL_BRACKET") return fullGameAvailable && resolveGamePhase(f, now).creatable;
    if (f === "MATCH_DAY_3_PICKEM") return md3Available;
    return resolveGamePhase(f, now).creatable;
  };

  const cards: GameCardVM[] = orderedFormats(now).map((f) => ({
    value: f,
    title: GAME_CATALOG[f].name,
    blurb: GAME_CATALOG[f].blurb,
    stateLine: gameStateLine(f, now),
    prizeTeaser: prizeTeaser(f),
    disabled: !isCreatable(f),
  }));

  // The requested / default selection: honour ?game= when creatable, else the
  // first creatable card.
  const requested: PoolFormat | null =
    game === "md3" ? "MATCH_DAY_3_PICKEM" : game === "knockout" ? "KNOCKOUT" : null;
  const defaultFormat: PoolFormat =
    requested && isCreatable(requested)
      ? requested
      : cards.find((c) => !c.disabled)?.value ?? "KNOCKOUT";

  const lead = GAME_CATALOG[defaultFormat];

  return (
    <main className="mx-auto max-w-[480px] px-5 pb-16 pt-12">
      <Link
        href="/"
        className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
      >
        ← Back
      </Link>

      <div className="mt-4">
        <Hero />
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
          New pool
        </p>
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">
          Start a {lead.name}
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">
          {lead.blurb} You&apos;ll get a join code to share.
        </p>

        {user ? (
          <CreatePoolForm
            defaultDisplayName={user.name ?? ""}
            defaultFormat={defaultFormat}
            cards={cards}
          />
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-surface-sunk p-5 text-center">
            <p className="text-sm text-ink-3">Sign in to create a pool.</p>
            <Link
              href="/signin"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-pitch-dark"
            >
              Sign in →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
