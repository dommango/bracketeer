import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { signOutAction } from "@/lib/auth/actions";
import type { PoolFormat } from "@/lib/pool/manage";
import { resolveGamePhase, GAME_CATALOG } from "@/lib/pool/games";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { getUserBrackets, type BracketSummary } from "@/lib/bracket/gallery";
import { PublicGames } from "./PublicGames";
import { SignInPanel } from "./signin/SignInPanel";
import { StartAPoolPromo } from "./StartAPoolPromo";
import { Footer } from "./Footer";
import { YourGames, type YourGame } from "./YourGames";

// Session-aware landing. Signed-out visitors get the sign-in / register panel
// directly; signed-in visitors land on the hub — their games, available games,
// and their pools — regardless of how many pools they're in. (A dedicated
// marketing landing page comes later.)
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <SignInPanel dest="/" />;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: { id: true, role: true, pool: { select: { name: true, joinCode: true, format: true } } },
  });

  // The public challenges this user is already playing, surfaced at the top of the
  // hub. Both challenge formats are plain Entry rows, so the bracket gallery is the
  // single source — no extra per-game reads.
  const tournamentId = await getTournamentIdBySlug();
  const games = buildYourGames(await getUserBrackets(user.id, tournamentId));

  return (
    <SignedInHub
      name={user.name ?? user.email ?? "there"}
      pools={memberships.map((m) => ({
        name: m.pool.name,
        joinCode: m.pool.joinCode,
        format: m.pool.format as PoolFormat,
      }))}
      games={games}
    />
  );
}

// The user's active public challenges, derived from their brackets: knockout and
// Match Day Pickem each appear once when they hold at least one bracket of that
// game. Pool (full-bracket) entries are listed under "Your pools" instead.
function buildYourGames(brackets: BracketSummary[]): YourGame[] {
  const games: YourGame[] = [];

  const ko = brackets.filter((b) => b.format === "KNOCKOUT");
  if (ko.length > 0) {
    const entered = ko.filter((b) => b.enteredChallenge).length;
    games.push({
      name: GAME_CATALOG.KNOCKOUT.challengeName ?? "Knockout Challenge",
      detail:
        entered > 0
          ? `${entered} bracket${entered > 1 ? "s" : ""} in the Challenge`
          : `${ko.length} bracket${ko.length > 1 ? "s" : ""} — not entered yet`,
      href: "/challenge/picks",
    });
  }

  const md3 = brackets.filter((b) => b.format === "MATCH_DAY_3_PICKEM");
  if (md3.length > 0) {
    games.push({
      name: GAME_CATALOG.MATCH_DAY_3_PICKEM.challengeName ?? "Match Day Pickem",
      detail: "Your predictions",
      href: "/challenge/md3/play",
    });
  }

  return games;
}

const SECONDARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-[18px] font-semibold text-pitch-dark transition-colors hover:bg-surface-sunk active:scale-[0.97]";

function PoolStateBadge({ format, now }: { format: PoolFormat; now: Date }) {
  const label = resolveGamePhase(format, now).label;
  return (
    <span className="shrink-0 rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-2">
      {label}
    </span>
  );
}

function SignedInHub({
  name,
  pools,
  games,
}: {
  name: string;
  pools: { name: string; joinCode: string; format: PoolFormat }[];
  games: YourGame[];
}) {
  const now = new Date();
  return (
    <main className="mx-auto max-w-2xl px-5 pb-8 pt-12">
      <div className="flex items-center justify-between">
        <p className="truncate text-[13px] text-ink-3">
          Signed in as <span className="font-semibold text-ink-2">{name}</span>
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-surface-sunk px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
          >
            Sign out
          </button>
        </form>
      </div>

      <YourGames games={games} />

      <PublicGames now={now} />

      {pools.length > 0 ? (
        <div className="mt-4 rounded-3xl border border-line bg-pitch/[0.03] p-[22px]">
          <h2 className="font-display text-lg text-ink">Your pools</h2>
          <ul className="mt-4 space-y-2">
            {pools.map((p) => (
              <li key={p.joinCode}>
                <Link
                  href={`/pool/${p.joinCode}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{p.name}</span>
                    <span className="font-mono text-xs tracking-[0.1em] text-ink-3">
                      {p.joinCode}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PoolStateBadge format={p.format} now={now} />
                    <span className="font-display text-pitch-dark">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/join" className={SECONDARY_BTN}>
              Join a pool
            </Link>
            <Link href="/pool/create" className={SECONDARY_BTN}>
              Create a pool
            </Link>
          </div>
        </div>
      ) : (
        <StartAPoolPromo now={now} />
      )}

      <Footer />
    </main>
  );
}
