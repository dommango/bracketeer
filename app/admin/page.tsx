import { redirect } from "next/navigation";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { prisma } from "@/lib/db";
import { asResults } from "@/lib/pool/scoring";
import { resolveBracket } from "@/lib/pool/bracket";
import { GROUPS, TEAMS, R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";
import { saveStandingsAction, saveAwardsAction } from "./actions";
import { KnockoutEditor, type KnockoutRowData } from "./KnockoutEditor";
import { signOutAction } from "@/lib/auth/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ALL_TEAM_OPTIONS = Object.keys(TEAMS)
  .sort((a, b) => TEAMS[a].localeCompare(TEAMS[b]))
  .map((code) => ({ code, label: `${TEAMS[code]} (${code})` }));

export default async function AdminPage() {
  const admin = await getTournamentAdmin();
  if (!admin) redirect("/signin?error=forbidden");

  const tournamentId = await getTournamentIdBySlug();
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const results = asResults(tournament.officialResults);
  const bracket = resolveBracket(results);

  const resultRows = await prisma.result.findMany({
    where: { match: { tournamentId } },
    include: { match: { select: { matchNo: true } } },
  });
  const scoreByMatch = new Map(resultRows.map((r) => [r.match.matchNo, r]));

  const teamLabel = (code: string | null | undefined) => (code && TEAMS[code] ? TEAMS[code] : "TBD");

  const buildRow = (matchNo: number, roundLabel: string): KnockoutRowData => {
    const m = bracket[matchNo];
    const known = Boolean(m?.home && m?.away);
    const options = known
      ? [m.home!, m.away!].map((code) => ({ code, label: `${TEAMS[code]} (${code})` }))
      : ALL_TEAM_OPTIONS;
    const score = scoreByMatch.get(matchNo);
    return {
      matchNo,
      roundLabel,
      homeLabel: teamLabel(m?.home),
      awayLabel: teamLabel(m?.away),
      currentWinner: m?.winner ?? "",
      currentHomeScore: score?.homeScore ?? null,
      currentAwayScore: score?.awayScore ?? null,
      options,
    };
  };

  const knockoutRows: KnockoutRowData[] = [
    ...R32.map((m) => buildRow(m.id, "Round of 32")),
    ...R16.map((m) => buildRow(m.id, "Round of 16")),
    ...QF.map((m) => buildRow(m.id, "Quarter-finals")),
    ...SF.map((m) => buildRow(m.id, "Semi-finals")),
    buildRow(BRONZE.id, "Third place"),
    buildRow(FINAL.id, "Final"),
  ];

  const thirds = results.thirdAdvance ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between rounded-2xl bg-pitch p-6 text-white">
        <div>
          <p className="text-gold text-xs font-semibold uppercase tracking-wide">Admin</p>
          <h1 className="mt-0.5 text-2xl font-bold">{tournament.name}</h1>
          <p className="mt-1 text-sm text-white/70">Signed in as {admin.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25">
            Sign out
          </button>
        </form>
      </header>

      {/* QUICK LINKS */}
      <nav className="mt-4 flex gap-2">
        <Link
          href="/admin/entries"
          className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5"
        >
          Entry picks →
        </Link>
      </nav>

      {/* GROUP STANDINGS */}
      <section className="mt-6">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">
          Group standings
        </h2>
        <form action={saveStandingsAction} className="mt-2 rounded-2xl border border-black/10 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(GROUPS).map((g) => (
              <fieldset key={g} className="rounded-xl border border-black/10 p-3">
                <legend className="px-1 text-sm font-semibold">Group {g}</legend>
                {(["first", "second"] as const).map((pos) => (
                  <label key={pos} className="mt-1 block text-xs text-black/60">
                    {pos === "first" ? "1st" : "2nd"}
                    <select
                      name={`${pos}_${g}`}
                      defaultValue={pos === "first" ? results.groupFirst?.[g] ?? "" : results.groupSecond?.[g] ?? ""}
                      className="mt-0.5 w-full rounded-lg border border-black/15 px-2 py-1.5 text-sm text-black"
                    >
                      <option value="">—</option>
                      {GROUPS[g].map((code) => (
                        <option key={code} value={code}>
                          {TEAMS[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-black/50">
            Third-place advancers (8)
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <select
                key={i}
                name={`third_${i + 1}`}
                defaultValue={thirds[i] ?? ""}
                aria-label={`Third advancer ${i + 1}`}
                className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {ALL_TEAM_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <button className="mt-4 rounded-full bg-pitch px-5 py-2 font-medium text-white hover:bg-pitch-dark">
            Save standings &amp; recompute
          </button>
        </form>
      </section>

      {/* KNOCKOUTS */}
      <section className="mt-8">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">
          Knockout results
        </h2>
        <p className="px-1 pb-2 text-xs text-black/50">
          Enter winners in bracket order — each result advances the winner into the next round.
        </p>
        <KnockoutEditor rows={knockoutRows} />
      </section>

      {/* AWARDS */}
      <section className="mt-8">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">Awards</h2>
        <form action={saveAwardsAction} className="mt-2 grid gap-3 rounded-2xl border border-black/10 bg-white p-5 sm:grid-cols-2">
          {(
            [
              ["player", "Player of the Tournament"],
              ["young", "Young Player"],
              ["boot", "Golden Boot"],
              ["goal", "Goal of the Tournament"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm text-black/70">
              {label}
              <input
                name={key}
                defaultValue={results.awards?.[key] ?? ""}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-black"
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <button className="rounded-full bg-pitch px-5 py-2 font-medium text-white hover:bg-pitch-dark">
              Save awards &amp; recompute
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
