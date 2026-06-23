import { redirect } from "next/navigation";
import Link from "next/link";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { prisma } from "@/lib/db";
import { GAME_CATALOG } from "@/lib/pool/games";
import type { PoolFormat } from "@/lib/pool/manage";
import { markPrizeSentAction } from "../actions";

export const dynamic = "force-dynamic";

function challengeLabel(challenge: string): string {
  return GAME_CATALOG[challenge as PoolFormat]?.challengeName ?? challenge;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gold-tint text-gold-dark",
  REVIEW: "bg-negative/10 text-negative",
  SENT: "bg-pitch-tint text-pitch-dark",
  SKIPPED: "bg-black/5 text-black/50",
};

export default async function AdminPrizesPage() {
  const admin = await getTournamentAdmin();
  if (!admin) redirect("/signin?error=forbidden");

  const tournamentId = await getTournamentIdBySlug();
  const awards = await prisma.prizeAward.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "desc" },
  });

  // Resolve winner display info (entry label + user email) from the plain-id FKs.
  const entryIds = awards.map((a) => a.entryId).filter((x): x is string => Boolean(x));
  const userIds = awards.map((a) => a.userId).filter((x): x is string => Boolean(x));
  const [entries, users] = await Promise.all([
    entryIds.length
      ? prisma.entry.findMany({ where: { id: { in: entryIds } }, select: { id: true, label: true } })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
      : Promise.resolve([]),
  ]);
  const labelByEntry = new Map(entries.map((e) => [e.id, e.label]));
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between rounded-2xl bg-pitch p-6 text-white">
        <div>
          <p className="text-gold text-xs font-semibold uppercase tracking-wide">Admin</p>
          <h1 className="mt-0.5 text-2xl font-bold">Challenge prizes</h1>
          <p className="mt-1 text-sm text-white/70">Signed in as {admin.email}</p>
        </div>
        <Link
          href="/admin"
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
        >
          ← Admin
        </Link>
      </header>

      <section className="mt-6">
        {awards.length === 0 ? (
          <p className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
            No prizes recorded yet. Awards appear here once a public challenge completes (the resolver
            runs on the cron schedule, or hit <code>/api/cron/resolve-prizes</code>).
          </p>
        ) : (
          <ul className="space-y-3">
            {awards.map((a) => {
              const winnerLabel = a.entryId ? labelByEntry.get(a.entryId) ?? "(entry)" : null;
              const winnerEmail = a.userId ? emailByUser.get(a.userId) ?? null : null;
              return (
                <li key={a.id} className="rounded-2xl border border-black/10 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-black">
                        {challengeLabel(a.challenge)}
                      </p>
                      <p className="mt-0.5 text-sm text-black/60">
                        {a.status === "REVIEW"
                          ? "Rank-1 tie — resolve manually, then award."
                          : winnerLabel
                            ? `Winner: ${winnerLabel}${winnerEmail ? ` · ${winnerEmail}` : ""}`
                            : "No winner recorded"}
                      </p>
                      <p className="mt-0.5 text-sm text-black/50">
                        Prize — {a.description}
                        {a.amount != null ? ` (${a.amount} ${a.currency})` : ""}
                      </p>
                      {a.sentAt ? (
                        <p className="mt-0.5 text-xs text-black/40">
                          Sent {a.sentAt.toISOString().slice(0, 10)} by {a.sentBy ?? "—"}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        STATUS_STYLE[a.status] ?? "bg-black/5 text-black/50"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>

                  {a.status === "PENDING" || a.status === "REVIEW" ? (
                    <form action={markPrizeSentAction} className="mt-3">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-full bg-pitch px-4 py-2 text-sm font-medium text-white hover:bg-pitch-dark">
                        Mark gift card sent
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
