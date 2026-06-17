import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getPoolView, getPoolAnalytics } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { getUserEntries } from "@/lib/pool/submit-picks";
import { PoolAnalytics } from "../PoolAnalytics";

// Landing hub for the Brackets section: your picks, everyone's brackets, and the
// head-to-head compare tool. Request-time because it reflects the signed-in user.
export const dynamic = "force-dynamic";

type CardProps = { href: string; title: string; desc: string; meta?: string };

function HubCard({ href, title, desc, meta }: CardProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)] transition-colors hover:border-pitch"
    >
      <span className="min-w-0">
        <span className="block font-display text-lg text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-3">{desc}</span>
      </span>
      <span className="shrink-0 text-right">
        {meta ? <span className="block font-display text-pitch-dark tabular-nums">{meta}</span> : null}
        <span className="font-display text-pitch-dark">→</span>
      </span>
    </Link>
  );
}

export default async function BracketsHubPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const sessionUser = await getSessionUser();
  const [poolView, myEntries, analytics] = await Promise.all([
    getPoolView(code),
    sessionUser ? getUserEntries(pool.id, sessionUser.id) : Promise.resolve([]),
    getPoolAnalytics(pool.id),
  ]);
  const entryCount = poolView?.leaderboard.length ?? 0;
  const myCount = myEntries.length;

  return (
    <section className="space-y-4">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Brackets</h2>
      <div className="space-y-2">
        <HubCard
          href={`/pool/${code}/picks`}
          title="My Bracket"
          desc={myCount > 1 ? "Edit any of your brackets and see your breakdown." : "Make or edit your picks and see your breakdown."}
          meta={myCount > 0 ? `${myCount}` : undefined}
        />
        <HubCard
          href={`/pool/${code}/leaderboard`}
          title="Contestants"
          desc="Standings and everyone's brackets in this pool."
          meta={entryCount > 0 ? `${entryCount}` : undefined}
        />
        {entryCount >= 2 ? (
          <HubCard
            href={`/pool/${code}/compare`}
            title="Compare"
            desc="Put two brackets side by side and spot where they diverge."
          />
        ) : null}
      </div>

      {analytics ? <PoolAnalytics analytics={analytics} code={code} /> : null}
    </section>
  );
}
