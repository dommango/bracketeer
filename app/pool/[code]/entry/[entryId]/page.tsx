import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getEntryProfile } from "@/lib/pool/entryProfile";
import { Flag } from "../../Flag";

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-center shadow-[var(--shadow-xs)]">
      <p className="font-display text-[26px] leading-none tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink-3">{sub}</p> : null}
    </div>
  );
}

export default async function EntryProfilePage({
  params,
}: {
  params: Promise<{ code: string; entryId: string }>;
}) {
  const { code, entryId } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const p = await getEntryProfile(pool.id, entryId);
  if (!p) notFound();

  const b = p.byCategory;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/pool/${code}#leaderboard`} className="text-sm font-semibold text-pitch hover:underline">
        ← Back to {pool.name}
      </Link>

      <header className="mt-4 rounded-3xl bg-pitch p-6 text-white shadow-[var(--shadow-md)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold">Bracket</p>
        <h1 className="mt-1 font-display text-[28px] leading-tight">{p.label}</h1>
        <p className="mt-2 font-display text-4xl tabular-nums">
          {p.total}
          <span className="ml-1 text-base font-medium text-white/70">pts</span>
        </p>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2">
        <Stat
          label="KO calls"
          value={`${p.accuracy.correct}/${p.accuracy.decided}`}
          sub={p.accuracy.decided ? `${p.accuracy.pct}% correct` : "none decided"}
        />
        <Stat label="Ceiling" value={`${p.ceiling}`} sub={`+${p.potential} to play for`} />
        <div className="rounded-2xl border border-line bg-surface p-4 text-center shadow-[var(--shadow-xs)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">Champion</p>
          {p.champion.code ? (
            <>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 font-display text-lg text-ink">
                <Flag code={p.champion.code} size={18} /> {p.champion.code}
              </p>
              <p
                className={`mt-0.5 text-xs font-semibold ${
                  p.champion.alive ? "text-pitch" : "text-ink-4"
                }`}
              >
                {p.champion.alive ? "Still alive" : "Eliminated"}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-ink-3">—</p>
          )}
        </div>
      </section>

      {p.boldest ? (
        <section className="mt-4 rounded-2xl border border-gold bg-gold-tint p-4 shadow-[var(--shadow-xs)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pitch-dark">
            Boldest call
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-ink">
            <Flag code={p.boldest.code} size={20} />
            <span className="font-semibold">{p.boldest.name}</span>
            <span className="text-sm text-ink-3">
              to win M{p.boldest.matchNo} — only {p.boldest.pct}% of the pool agreed
              {p.boldest.points ? ` · ${p.boldest.points} pts` : ""}
            </span>
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Points by category
        </h2>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {CATEGORY_LABELS.map(([k, label]) => (
            <span
              key={k}
              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
                (b[k] ?? 0) > 0 ? "bg-pitch-tint text-pitch-dark" : "bg-surface-sunk text-ink-4"
              }`}
            >
              {label} {b[k] ?? 0}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
