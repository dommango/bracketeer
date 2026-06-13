import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolView } from "@/lib/pool/queries";
import { getComparison } from "@/lib/pool/comparison";
import { Flag } from "../Flag";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: [string, string][] = [
  ["group", "Groups"],
  ["thirds", "3rd place"],
  ["r32", "R32"],
  ["r16", "R16"],
  ["qf", "QF"],
  ["sf", "SF"],
  ["final", "Final"],
  ["awards", "Awards"],
];

// Two-click, no-JS entry picker: clicking sets ?a first, then ?b.
function Picker({
  code,
  rows,
  a,
}: {
  code: string;
  rows: { entryId: string; label: string }[];
  a?: string;
}) {
  return (
    <div className="mt-6">
      <p className="px-1 text-sm text-ink-3">
        {a ? "Pick the second bracket to compare against." : "Pick the first bracket."}
      </p>
      <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows
          .filter((r) => r.entryId !== a)
          .map((r) => {
            const href = a
              ? `/pool/${code}/compare?a=${a}&b=${r.entryId}`
              : `/pool/${code}/compare?a=${r.entryId}`;
            return (
              <Link
                key={r.entryId}
                href={href}
                className="truncate rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-[var(--shadow-xs)] hover:border-pitch"
              >
                {r.label}
              </Link>
            );
          })}
      </ul>
    </div>
  );
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { code } = await params;
  const { a, b } = await searchParams;
  const pool = await getPoolView(code);
  if (!pool) notFound();

  const rows = pool.leaderboard.map((r) => ({ entryId: r.entryId, label: r.label }));

  const back = (
    <Link href={`/pool/${code}`} className="text-sm font-semibold text-pitch hover:underline">
      ← Back to {pool.name}
    </Link>
  );

  if (!a || !b) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        {back}
        <h1 className="mt-4 font-display text-2xl text-ink">Compare brackets</h1>
        <Picker code={code} rows={rows} a={a} />
      </main>
    );
  }

  const cmp = await getComparison(pool.id, a, b);
  if (!cmp) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {back}

      <header className="mt-4 grid grid-cols-2 gap-2">
        {[cmp.a, cmp.b].map((s, i) => (
          <div
            key={s.entryId}
            className={`rounded-2xl p-4 text-white ${i === 0 ? "bg-pitch" : "bg-pitch-deep"}`}
          >
            <p className="truncate font-display text-lg">{s.label}</p>
            <p className="font-display text-3xl tabular-nums">
              {s.total}
              <span className="ml-1 text-sm font-medium text-white/70">pts</span>
            </p>
            {s.champion.code ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                <Flag code={s.champion.code} size={14} /> {s.champion.code}
                {s.champion.alive ? "" : " (out)"}
              </p>
            ) : null}
          </div>
        ))}
      </header>

      <section className="mt-6">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Points by category
        </h2>
        <div className="mt-2.5 overflow-hidden rounded-2xl border border-line">
          {CATEGORY_LABELS.map(([k, label]) => {
            const av = cmp.a.byCategory[k] ?? 0;
            const bv = cmp.b.byCategory[k] ?? 0;
            return (
              <div
                key={k}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line-soft bg-surface px-3 py-2 text-sm last:border-b-0"
              >
                <span className={`text-right tabular-nums ${av > bv ? "font-bold text-pitch" : "text-ink-3"}`}>
                  {av}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-4">
                  {label}
                </span>
                <span className={`tabular-nums ${bv > av ? "font-bold text-pitch" : "text-ink-3"}`}>
                  {bv}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Where they diverge ({cmp.divergences.length})
        </h2>
        {cmp.divergences.length === 0 ? (
          <p className="mt-2.5 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
            Identical knockout picks.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {cmp.divergences.map((d) => (
              <li
                key={d.matchNo}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-sm shadow-[var(--shadow-xs)]"
              >
                <span className={`flex items-center justify-end gap-1.5 ${d.aCorrect ? "font-bold text-pitch" : d.decided ? "text-ink-4" : "text-ink"}`}>
                  {d.aName ?? "—"} <Flag code={d.aCode} size={16} />
                  {d.aCorrect ? " ✓" : ""}
                </span>
                <span className="shrink-0 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">
                  {d.roundLabel}
                  <br />M{d.matchNo}
                </span>
                <span className={`flex items-center gap-1.5 ${d.bCorrect ? "font-bold text-pitch" : d.decided ? "text-ink-4" : "text-ink"}`}>
                  <Flag code={d.bCode} size={16} /> {d.bName ?? "—"}
                  {d.bCorrect ? " ✓" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
