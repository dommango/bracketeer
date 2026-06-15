import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPoolByCode,
  getGroupMatchCenter,
  getPoolBracket,
  isGroupStageComplete,
} from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { kickoffFor } from "@/lib/scoring/schedule";
import { formatMatchDate } from "@/lib/pool/format";
import { byGroupSections, byDaySections, byCityVenues } from "@/lib/pool/fixture-views";
import { MatchCenter } from "../MatchCenter";
import { VenueGrid } from "../VenueGrid";
import { GroupStandings, Bracket } from "../Bracket";

// Fixtures + live status change at request time.
export const dynamic = "force-dynamic";

type FixturesView = "groups" | "knockouts";
type FixtureGrouping = "group" | "day" | "city";

// Date span of a contiguous matchNo range (e.g. "Thu, Jun 11 – Sat, Jun 27"),
// from the static schedule. Null when none of the matches are scheduled.
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

function Toggle({ code, active }: { code: string; active: FixturesView }) {
  const tab = (view: FixturesView, label: string) => {
    const on = active === view;
    return (
      <Link
        href={`/pool/${code}/matches?view=${view}`}
        aria-current={on ? "page" : undefined}
        className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition-colors ${
          on ? "bg-pitch text-white shadow-[var(--shadow-xs)]" : "text-ink-2 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <div>
      <div className="flex gap-1 rounded-full border border-line bg-surface-sunk p-1">
        {tab("groups", "Group Stage")}
        {tab("knockouts", "Knockout Stage")}
      </div>
      {(active === "groups" ? GROUP_RANGE : KNOCKOUT_RANGE) ? (
        <p className="mt-1.5 text-center font-mono text-[11px] text-ink-3">
          {active === "groups" ? GROUP_RANGE : KNOCKOUT_RANGE}
        </p>
      ) : null}
    </div>
  );
}

function GroupingToggle({ code, active }: { code: string; active: FixtureGrouping }) {
  const tab = (fx: FixtureGrouping, label: string) => {
    const on = active === fx;
    return (
      <Link
        href={`/pool/${code}/matches?view=groups&fx=${fx}`}
        aria-current={on ? "page" : undefined}
        className={`flex-1 rounded-full px-3 py-1.5 text-center text-[13px] font-semibold transition-colors ${
          on ? "bg-surface text-ink shadow-[var(--shadow-xs)]" : "text-ink-3 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="flex gap-1 rounded-full border border-line bg-surface-sunk p-1">
      {tab("group", "By group")}
      {tab("day", "By day")}
      {tab("city", "By city")}
    </div>
  );
}

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ view?: string; fx?: string }>;
}) {
  const { code } = await params;
  const { view, fx } = await searchParams;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const sessionUser = await getSessionUser();
  const [sections, bracket, groupsDone] = await Promise.all([
    getGroupMatchCenter(pool.id, sessionUser?.id ?? null),
    getPoolBracket(pool.id),
    isGroupStageComplete(pool.tournamentId),
  ]);

  // Default to groups until the group stage finishes, then default to knockouts.
  const active: FixturesView =
    view === "groups" || view === "knockouts" ? view : groupsDone ? "knockouts" : "groups";

  const groupSections = sections.filter((s) => s.roundCode === "GROUP");
  const groupRows = groupSections.flatMap((s) => s.matches);
  const grouping: FixtureGrouping =
    fx === "group" || fx === "day" || fx === "city" ? fx : "group";

  return (
    <div className="space-y-5">
      <Toggle code={code} active={active} />

      {active === "groups" ? (
        <>
          {bracket ? (
            <section>
              <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                Group standings
              </h2>
              <div className="mt-2.5">
                <GroupStandings view={bracket} code={code} />
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              Group fixtures
            </h2>
            <div className="mt-2.5">
              <GroupingToggle code={code} active={grouping} />
            </div>
            <div className="mt-3">
              {grouping === "city" ? (
                <VenueGrid code={code} venues={byCityVenues(groupRows)} />
              ) : (
                <MatchCenter
                  sections={
                    grouping === "day" ? byDaySections(groupRows) : byGroupSections(groupSections)
                  }
                  code={code}
                />
              )}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Bracket</h2>
          <div className="mt-2.5">
            {bracket ? (
              <Bracket view={bracket} />
            ) : (
              <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
                The knockout bracket will appear here.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
