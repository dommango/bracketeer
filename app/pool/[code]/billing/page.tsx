import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { stripeEnabled } from "@/lib/env";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess } from "@/lib/pool/access";
import { isPremium, memberCap, remainingSlots, FREE_MEMBER_CAP } from "@/lib/billing/entitlements";
import { UpgradeButton } from "./UpgradeButton";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { code } = await params;
  const { upgraded } = await searchParams;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const access = await getPoolAccess(pool.id);
  // Billing is owner-only; don't leak the page's existence to others.
  if (!access?.isOwner) notFound();

  const memberCount = await prisma.membership.count({ where: { poolId: pool.id } });
  const premium = isPremium(pool.tier);
  const cap = memberCap(pool.tier);
  const slots = remainingSlots(pool.tier, memberCount);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <div className="flex items-center justify-between">
        <Link
          href={`/pool/${code}/manage`}
          className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
        >
          ← Back to manage
        </Link>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${
            premium ? "bg-gold/20 text-gold-dark" : "bg-pitch-tint text-pitch-dark"
          }`}
        >
          {premium ? "Premium" : "Free"}
        </span>
      </div>

      <h1 className="mt-4 font-display text-[26px] leading-tight text-ink">Billing &amp; plan</h1>
      <p className="mt-1 text-sm text-ink-3">{pool.name}</p>

      {/* Stripe redirects here on success; the webhook flips the tier moments
          later, so reflect either state honestly. */}
      {upgraded ? (
        <div className="mt-5 rounded-2xl border border-pitch/30 bg-pitch-tint px-4 py-3 text-sm text-pitch-dark">
          {premium
            ? "🎉 Premium is active — your pool is now uncapped."
            : "Payment received — Premium is activating. Refresh in a moment."}
        </div>
      ) : null}

      {/* Usage */}
      <section className="mt-7">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Members</h2>
        <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{memberCount}</span>{" "}
            {cap === null ? "members (unlimited)" : `of ${cap} members`}
          </p>
          {cap !== null && slots !== null ? (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
              <div
                className={`h-full rounded-full ${slots === 0 ? "bg-negative" : "bg-pitch"}`}
                style={{ width: `${Math.min(100, (memberCount / cap) * 100)}%` }}
              />
            </div>
          ) : null}
          {cap !== null && slots === 0 ? (
            <p className="mt-2 text-sm text-negative">
              Your pool is full. Upgrade to add more players.
            </p>
          ) : null}
        </div>
      </section>

      {/* Plan / upgrade */}
      <section className="mt-7">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Plan</h2>
        <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
          {premium ? (
            <p className="text-sm text-ink-2">
              This pool is on <span className="font-semibold text-gold-dark">Premium</span> — no
              member limit. Manage or cancel your subscription anytime from your Stripe receipt
              email.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">Premium</span> lifts the{" "}
                {FREE_MEMBER_CAP}-member limit so your whole crew can join.
              </p>
              <div className="mt-3">
                {stripeEnabled ? (
                  <UpgradeButton code={code} />
                ) : (
                  <p className="rounded-md border border-line bg-surface-sunk px-3 py-2 text-sm text-ink-3">
                    Online upgrades aren&apos;t available yet — check back soon.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
