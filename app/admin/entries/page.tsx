import Link from "next/link";
import { redirect } from "next/navigation";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { prisma } from "@/lib/db";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { reconcileKnockoutPicks, inconsistentKnockoutPicks, scoredKnockoutNumbers } from "@/lib/pool/pick-form";
import type { PickRow } from "@/lib/pool/picks";

export const dynamic = "force-dynamic";

function knockoutStats(rows: PickRow[]) {
  const sub = pickRowsToSubmission(rows);
  const raw = sub.picks;
  const scored = scoredKnockoutNumbers();
  const stored = scored.filter((n) => raw.knockout[n]).length;
  const reconciled = reconcileKnockoutPicks(raw);
  const valid = scored.filter((n) => reconciled.knockout[n]).length;
  const bad = inconsistentKnockoutPicks(raw);
  return { stored, valid, bad };
}

export default async function AdminEntriesPage() {
  const admin = await getTournamentAdmin();
  if (!admin) redirect("/signin?error=forbidden");

  const tournamentId = await getTournamentIdBySlug();
  const pools = await prisma.pool.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
  });

  const allEntries = await Promise.all(
    pools.map((pool) =>
      prisma.entry.findMany({
        where: { poolId: pool.id },
        include: { picks: true },
        orderBy: { label: "asc" },
      }).then((entries) => entries.map((e) => ({ ...e, poolName: pool.name, joinCode: pool.joinCode }))),
    ),
  );
  const entries = allEntries.flat();

  const rows = entries.map((e) => {
    const stats = knockoutStats(e.picks as PickRow[]);
    return { ...e, ...stats };
  });

  const issueRows = rows.filter((r) => r.valid < 31 || r.bad.length > 0);
  const cleanRows = rows.filter((r) => r.valid === 31 && r.bad.length === 0);

  const EntryRow = ({ r }: { r: (typeof rows)[0] }) => (
    <tr className="border-t border-black/5 hover:bg-black/2">
      <td className="py-2 pr-4 text-sm font-medium">{r.label}</td>
      <td className="py-2 pr-4 text-xs text-black/50">{r.joinCode}</td>
      <td className="py-2 pr-4 text-xs text-black/50">{r.claimEmail ?? "—"}</td>
      <td className="py-2 pr-4 text-center text-sm">
        <span className={r.valid < 31 ? "font-semibold text-red-600" : "text-black/40"}>
          {r.valid}/31
        </span>
      </td>
      <td className="py-2 pr-4 text-center text-sm">
        {r.bad.length > 0 ? (
          <span className="font-semibold text-orange-600">{r.bad.length}</span>
        ) : (
          <span className="text-black/30">0</span>
        )}
      </td>
      <td className="py-2">
        <Link
          href={`/admin/entries/${r.id}`}
          className="rounded-full bg-pitch px-3 py-1 text-xs font-medium text-white hover:bg-pitch/80"
        >
          Edit picks
        </Link>
      </td>
    </tr>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-sm text-black/40 hover:text-black">
          ← Admin
        </Link>
        <h1 className="text-xl font-bold">Entry picks</h1>
      </div>

      {issueRows.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">
            Entries with issues ({issueRows.length})
          </h2>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-black/40">
                  <th className="pb-2 pr-4">Name / label</th>
                  <th className="pb-2 pr-4">Pool</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4 text-center">KO picks</th>
                  <th className="pb-2 pr-4 text-center">Bad slots</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {issueRows.map((r) => <EntryRow key={r.id} r={r} />)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/40">
          Clean entries ({cleanRows.length})
        </h2>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-black/40">
                <th className="pb-2 pr-4">Name / label</th>
                <th className="pb-2 pr-4">Pool</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4 text-center">KO picks</th>
                <th className="pb-2 pr-4 text-center">Bad slots</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {cleanRows.map((r) => <EntryRow key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
