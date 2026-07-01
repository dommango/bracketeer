import Link from "next/link";
import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getTopScorers,
  getChampionshipOdds,
  getGoalscorerOutrights,
  isGroupStageComplete,
} from "@/lib/pool/queries";
import { getMd3FullMatchCenter, getMd3Bracket } from "@/lib/challenge/md3-dashboard";
import { getKnockoutChallengeMatchCenter } from "@/lib/challenge/knockout-dashboard";
import { getSessionUser } from "@/lib/pool/access";
import { kickoffFor } from "@/lib/scoring/schedule";
import { formatMatchDate } from "@/lib/pool/format";
import { byGroupSections, byDaySections, byCityVenues } from "@/lib/pool/fixture-views";
import { MatchCenter } from "@/app/pool/[code]/MatchCenter";
import { VenueGrid } from "@/app/pool/[code]/VenueGrid";
import { GroupStandings } from "@/app/pool/[code]/Bracket";
import { ChampionshipOdds } from "@/app/pool/[code]/ChampionshipOdds";
import { OddsBoard } from "@/app/pool/[code]/OddsBoard";
import { Scorers } from "@/app/pool/[code]/Scorers";

// Live results change at request time.
export const dynamic = "force-dynamic";

// The Matches tab is tournament-wide, not game-specific, so it's unified across
// both challenges (like /challenge/picks) — no per-game hero, no game switcher.
// The view toggle links stay on this route; the team / player / stadium detail
// pages are tournament-wide and live under each game tree, so we point at one
// canonical tree. Match detail routes by matchNo to the right game's page.
const SELF = "/challenge/matches";
const SUB = "/challenge/md3";
const matchHref = (no: number) =>
  no >= 73 ? `/challenge/knockout/matches/${no}` : `/challenge/md3/matches/${no}`;

type FixturesView = "groups" | "knockouts" | "scorers" | "odds";
const FIXTURE_VIEWS: FixturesView[] = ["groups", "knockouts", "scorers", "odds"];
type FixtureGrouping = "group" | "day" | "city";

// Date span of a contiguous matchNo range (e.g. "Thu, Jun 11 – Sat, Jun 27").
function stageDateRange(from: number, to: number): string | null {
  let min: number | null = null;
  let max: number | null = null;
  for (let n = from; n <= to; n++) {
    const d = kickoffFor(n);
    if (!d) continue;
    const t = d.getTime();
    if (min === null || t < min) min = t;
    if (max === null || t > max) max = t;
  }
  if (min === null || max === null) return null;
  const a = formatMatchDate(new Date(min).toISOString());
  const b = formatMatchDate(new Date(max).toISOString());
  return a === b ? a : `${a} – ${b}`;
}

const GROUP_RANGE = stageDateRange(1, 72);
const KNOCKOUT_RANGE = stageDateRange(73, 104);

function Toggle({ active }: { active: FixturesView }) {
  const tab = (view: FixturesView, label: string) => {
    const on = active === view;
    return (
      <Link
        href={`${SELF}?view=${view}`}
        aria-current={on ? "page" : undefined}
        className={`inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 py-2 text-center text-[13px] font-semibold transition-colors ${
          on
            ? "bg-pitch-tint text-pitch-dark shadow-[inset_0_0_0_1px_var(--color-gold)]"
            : "text-ink-3 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };
  const range = active === "groups" ? GROUP_RANGE : active === "knockouts" ? KNOCKOUT_RANGE : null;
  return (
    <div>
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {tab("groups", "Groups")}
        {tab("knockouts", "Knockouts")}
        {tab("scorers", "Scorers")}
        {tab("odds", "Odds")}
      </div>
      {range ? (
        <p className="mt-1.5 text-center font-mono text-[11px] text-ink-3">{range}</p>
      ) : null}
    </div>
  );
}

function GroupingToggle({ active }: { active: FixtureGrouping }) {
  const tab = (fx: FixtureGrouping, label: string) => {
    const on = active === fx;
    return (
      <Link
        href={`${SELF}?view=groups&fx=${fx}#group-fixtures`}
        aria-current={on ? "page" : undefined}
        className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-3 py-1.5 text-center text-[13px] font-semibold transition-colors ${
          on
            ? "bg-pitch-tint text-pitch-dark shadow-[inset_0_0_0_1px_var(--color-gold)]"
            : "text-ink-3 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
      {tab("group", "By group")}
      {tab("day", "By day")}
      {tab("city", "By city")}
    </div>
  );
}

export default async function ChallengeMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; fx?: string | string[] }>;
}) {
  const { view: viewParam, fx: fxParam } = await searchParams;
  const view = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const fx = Array.isArray(fxParam) ? fxParam[0] : fxParam;

  const user = await getSessionUser();
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  // Combined pick overlay: MD3 scoreline picks ride along the group fixtures, the
  // knockout match center carries the viewer's winner picks.
  const [sections, knockoutSections, bracket, groupsDone, titleOdds, scorers, favorites] =
    await Promise.all([
      getMd3FullMatchCenter(user?.id ?? null),
      getKnockoutChallengeMatchCenter(user?.id ?? null),
      getMd3Bracket(),
      isGroupStageComplete(tournamentId),
      getChampionshipOdds(tournamentId),
      getTopScorers(tournamentId),
      getGoalscorerOutrights(tournamentId),
    ]);

  // Default to groups until the group stage finishes, then default to knockouts.
  const active: FixturesView = FIXTURE_VIEWS.includes(view as FixturesView)
    ? (view as FixturesView)
    : groupsDone
      ? "knockouts"
      : "groups";

  const groupSections = sections.filter((s) => s.roundCode === "GROUP");
  const groupRows = groupSections.flatMap((s) => s.matches);
  const grouping: FixtureGrouping =
    fx === "group" || fx === "day" || fx === "city" ? fx : "group";

  return (
    <section className="space-y-5">
      <header className="px-1">
        <h1 className="font-display text-xl text-ink">Matches</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          The full tournament — group stage through the final, with your picks marked.
        </p>
      </header>

      <Toggle active={active} />

      {active === "groups" ? (
        <>
          {bracket ? (
            <section>
              <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                Group standings
              </h2>
              <div className="mt-2.5">
                <GroupStandings view={bracket} basePath={SUB} />
              </div>
            </section>
          ) : null}

          <section id="group-fixtures" className="scroll-mt-4">
            <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              Group fixtures
            </h2>
            <div className="mt-2.5">
              <GroupingToggle active={grouping} />
            </div>
            <div className="mt-3">
              {grouping === "city" ? (
                <VenueGrid basePath={SUB} venues={byCityVenues(groupRows)} />
              ) : (
                <MatchCenter
                  sections={
                    grouping === "day" ? byDaySections(groupRows) : byGroupSections(groupSections)
                  }
                  hrefForMatch={matchHref}
                />
              )}
            </div>
          </section>
        </>
      ) : active === "knockouts" ? (
        <section>
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            Knockout bracket
          </h2>
          <p className="mt-0.5 px-1 text-[13px] text-ink-3">
            Round of 32 through the final — your winner picks marked.
          </p>
          <div className="mt-2.5">
            <MatchCenter sections={knockoutSections} hrefForMatch={matchHref} />
          </div>
        </section>
      ) : active === "scorers" ? (
        <Scorers scorers={scorers} basePath={SUB} />
      ) : titleOdds.length > 0 || favorites.length > 0 ? (
        <div className="space-y-5">
          {titleOdds.length > 0 ? <ChampionshipOdds odds={titleOdds} basePath={SUB} /> : null}
          {favorites.length > 0 ? (
            <OddsBoard
              title="Golden Boot odds"
              subtitle="Market-implied chance of finishing top scorer."
              fetchedAt={favorites[0]?.fetchedAt}
              rows={favorites.map((f) => ({
                key: f.playerName,
                code: f.teamCode,
                primary: f.playerName,
                winProb: f.winProb,
                href: `${SUB}/players/${encodeURIComponent(f.playerName)}`,
              }))}
            />
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          Title odds will appear here once the betting market opens.
        </p>
      )}
    </section>
  );
}
