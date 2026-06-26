import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { signOutAction } from "@/lib/auth/actions";
import { getAccountDeletionSummary } from "@/lib/account/delete";
import {
  updateDisplayNameAction,
  updateChallengeDisplayNameAction,
  deleteMyAccountAction,
} from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default async function AccountPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-[480px] px-5 pb-16 pt-12">
        <div className="rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm text-ink-3">Sign in to manage your account.</p>
          <Link
            href="/signin"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
          >
            Sign in →
          </Link>
        </div>
      </main>
    );
  }

  const [memberships, account, deletion] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        role: true,
        displayName: true,
        pool: { select: { name: true, joinCode: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { challengeDisplayName: true },
    }),
    getAccountDeletionSummary(user.id),
  ]);

  return (
    <main className="mx-auto max-w-[480px] px-5 pb-16 pt-12">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
        >
          ← Home
        </Link>
        <form action={signOutAction}>
          <button className="rounded-full bg-surface-sunk px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">Account</p>
        <h1 className="mt-1.5 font-display text-[24px] leading-tight text-ink">
          {user.name ?? "Your account"}
        </h1>
        <p className="mt-1 text-sm text-ink-3">{user.email}</p>

        <div className="mt-5 flex gap-2">
          <Link
            href="/pool/create"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-pitch px-4 text-sm font-semibold text-white hover:bg-pitch-dark"
          >
            Create a pool
          </Link>
          <Link
            href="/join"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-pitch-dark hover:bg-surface-sunk"
          >
            Join a pool
          </Link>
        </div>
      </div>

      <h2 className="mt-7 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Leaderboard display name
      </h2>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
        <p className="text-[13px] text-ink-3">
          How you appear on the Match Day Pickem leaderboard. Leave blank to use your account name.
        </p>
        <form action={updateChallengeDisplayNameAction} className="mt-3 flex gap-2">
          <input
            name="challengeDisplayName"
            defaultValue={account?.challengeDisplayName ?? ""}
            placeholder={user.name ?? "Your name"}
            maxLength={40}
            aria-label="Leaderboard display name"
            className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-pitch"
          />
          <button className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-surface-sunk px-4 text-sm font-semibold text-pitch-dark hover:bg-line-soft">
            Save
          </button>
        </form>
      </div>

      <h2 className="mt-7 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Your pools
      </h2>
      {memberships.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
          You haven&apos;t joined any pools yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {memberships.map((m) => (
            <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/pool/${m.pool.joinCode}`}
                  className="min-w-0 flex-1 truncate font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {m.pool.name}
                </Link>
                <span className="rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-pitch-dark">
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-ink-3">#{m.pool.joinCode}</p>

              <form action={updateDisplayNameAction} className="mt-3 flex gap-2">
                <input type="hidden" name="membershipId" value={m.id} />
                <input
                  name="displayName"
                  defaultValue={m.displayName}
                  maxLength={40}
                  aria-label="Display name"
                  className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-pitch"
                />
                <button className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-surface-sunk px-4 text-sm font-semibold text-pitch-dark hover:bg-line-soft">
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-7 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Your data
      </h2>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-ink-2">Download a copy of your data</p>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Everything we hold about you — account, pools, brackets, picks and messages — as a JSON file.
        </p>
        <a
          href="/api/account/export"
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-pitch-dark hover:bg-surface-sunk"
        >
          Export my data
        </a>
      </div>

      <div className="mt-3 rounded-2xl border border-negative/30 bg-negative/5 p-4">
        <p className="text-sm font-semibold text-negative">Delete my account</p>
        <p className="mt-0.5 text-[13px] text-ink-3">
          This permanently deletes your account, brackets, picks and messages and can&apos;t be undone.
          {deletion.ownedPoolCount > 0 ? (
            <>
              {" "}
              It will also delete{" "}
              <strong>
                {deletion.ownedPoolCount} pool{deletion.ownedPoolCount === 1 ? "" : "s"} you own
              </strong>{" "}
              and all of their members&apos; data.
            </>
          ) : null}
        </p>
        {deletion.pendingPrizeCount > 0 ? (
          <p className="mt-3 rounded-md border border-negative/40 bg-surface px-3 py-2 text-[13px] text-ink-2">
            You have a prize that hasn&apos;t been sent yet, so account deletion is paused. Email{" "}
            <a href="mailto:dommango@gmail.com" className="font-semibold text-pitch-dark hover:underline">
              dommango@gmail.com
            </a>{" "}
            to sort out your prize first.
          </p>
        ) : (
          <form action={deleteMyAccountAction} className="mt-3 flex gap-2">
            <input
              name="confirm"
              placeholder="Type DELETE to confirm"
              aria-label="Type DELETE to confirm account deletion"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-negative"
            />
            <button className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-negative px-4 text-sm font-semibold text-white hover:opacity-90">
              Delete
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
