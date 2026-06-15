import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess, canManagePool } from "@/lib/pool/access";
import { listPoolMembers, listPoolEntries } from "@/lib/pool/admin";
import { listPendingInvites } from "@/lib/pool/invites";
import { inviteUrl } from "@/lib/pool/invite-token";
import { isPremium, memberCap } from "@/lib/billing/entitlements";
import { CopyButton } from "./CopyButton";
import { ImportForm } from "./ImportForm";
import { InviteForm } from "./InviteForm";
import {
  setMemberRoleAction,
  removeMemberAction,
  renamePoolAction,
  deletePoolAction,
  setEntryLockedAction,
  removeEntryAction,
  revokeInviteAction,
} from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const access = await getPoolAccess(pool.id);
  // Hide the page entirely from non-managers — don't leak that it exists.
  if (!canManagePool(access)) notFound();
  const isOwner = access.isOwner;

  const [members, entries, invites] = await Promise.all([
    listPoolMembers(pool.id),
    listPoolEntries(pool.id),
    listPendingInvites(pool.id),
  ]);

  const joinUrl = `${env.APP_BASE_URL}/join?code=${pool.joinCode}`;
  const premium = isPremium(pool.tier);
  const cap = memberCap(pool.tier);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <div className="flex items-center justify-between">
        <Link
          href={`/pool/${code}`}
          className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
        >
          ← Back to pool
        </Link>
        <span className="rounded-full bg-pitch-tint px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-pitch-dark">
          {isOwner ? "Owner" : "Admin"}
        </span>
      </div>

      <h1 className="mt-4 font-display text-[26px] leading-tight text-ink">Manage pool</h1>
      <p className="mt-1 text-sm text-ink-3">{pool.name}</p>

      {/* Share */}
      <Section title="Invite players">
        <div className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center rounded-md border border-line bg-surface px-4">
            <span className="font-mono font-bold text-ink-3">#</span>
            <span className="ml-1 font-mono text-lg font-bold tracking-[0.1em] tabular-nums text-ink">
              {pool.joinCode}
            </span>
          </div>
          <CopyButton value={pool.joinCode} label="Copy code" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={joinUrl}
            aria-label="Join link"
            className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface-sunk px-3 text-sm text-ink-2 outline-none"
          />
          <CopyButton value={joinUrl} label="Copy link" />
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <InviteForm code={code} />
        </div>

        {invites.length > 0 ? (
          <div className="mt-4">
            <p className="px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Pending invites ({invites.length})
            </p>
            <ul className="mt-2 space-y-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {inv.email ?? "Link invite"}
                    </p>
                    <p className="truncate text-xs text-ink-3">
                      {inv.expiresAt
                        ? `Expires ${inv.expiresAt.toLocaleDateString()}`
                        : "No expiry"}
                    </p>
                  </div>
                  <CopyButton value={inviteUrl(env.APP_BASE_URL, inv.token)} label="Copy link" />
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="inviteId" value={inv.id} />
                    <button className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-semibold text-live hover:bg-surface-sunk">
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      {/* Plan — owner only */}
      {isOwner ? (
        <Section title="Plan">
          <Link
            href={`/pool/${code}/billing`}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {premium ? "Premium" : "Free"} plan
              </p>
              <p className="text-xs text-ink-3">
                {premium
                  ? "Unlimited members."
                  : `Up to ${cap} members. Upgrade for an unlimited pool.`}
              </p>
            </div>
            <span className="font-display text-pitch-dark">→</span>
          </Link>
        </Section>
      ) : null}

      {/* Members */}
      <Section title={`Members (${members.length})`}>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.membershipId}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{m.displayName}</p>
                <p className="truncate text-xs text-ink-3">{m.email ?? "no email"}</p>
              </div>
              <span className="rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-pitch-dark">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>

              {/* Owner-only governance: promote/demote + remove. The owner row
                  itself is never modifiable. */}
              {isOwner && !m.isOwner ? (
                <div className="flex gap-1.5">
                  <form action={setMemberRoleAction}>
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="membershipId" value={m.membershipId} />
                    <input
                      type="hidden"
                      name="role"
                      value={m.role === "ADMIN" ? "MEMBER" : "ADMIN"}
                    />
                    <button className="inline-flex h-9 items-center rounded-full bg-surface-sunk px-3 text-xs font-semibold text-pitch-dark hover:bg-line-soft">
                      {m.role === "ADMIN" ? "Make member" : "Make admin"}
                    </button>
                  </form>
                  <form action={removeMemberAction}>
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="membershipId" value={m.membershipId} />
                    <button className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-semibold text-live hover:bg-surface-sunk">
                      Remove
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {/* Entries */}
      <Section title={`Entries (${entries.length})`}>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
            No entries yet. Import the bracket CSVs below, or have members fill out
            their bracket.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.entryId}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{e.label}</p>
                  <p className="truncate text-xs text-ink-3">
                    {e.totalPoints} pts · {e.pickCount} picks ·{" "}
                    {e.claimed ? "claimed" : e.claimEmail ?? "unclaimed"}
                  </p>
                </div>
                {e.locked ? (
                  <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                    Locked
                  </span>
                ) : null}
                <div className="flex gap-1.5">
                  <form action={setEntryLockedAction}>
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="entryId" value={e.entryId} />
                    <input type="hidden" name="locked" value={e.locked ? "false" : "true"} />
                    <button className="inline-flex h-9 items-center rounded-full bg-surface-sunk px-3 text-xs font-semibold text-pitch-dark hover:bg-line-soft">
                      {e.locked ? "Unlock" : "Lock"}
                    </button>
                  </form>
                  <form action={removeEntryAction}>
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="entryId" value={e.entryId} />
                    <button className="inline-flex h-9 items-center rounded-full border border-line px-3 text-xs font-semibold text-live hover:bg-surface-sunk">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Import */}
      <Section title="Import brackets">
        <p className="text-sm text-ink-3">
          Upload the per-contestant CSV exports from the original bracket tool. Each
          file becomes an entry; re-importing the same contestant updates it.
        </p>
        <ImportForm code={code} />
      </Section>

      {/* Settings */}
      <Section title="Pool name">
        <form action={renamePoolAction} className="flex gap-2">
          <input type="hidden" name="code" value={code} />
          <input
            name="name"
            defaultValue={pool.name}
            maxLength={80}
            aria-label="Pool name"
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-pitch"
          />
          <button className="inline-flex h-11 shrink-0 items-center rounded-full bg-pitch px-5 text-sm font-semibold text-white hover:bg-pitch-dark">
            Save
          </button>
        </form>
      </Section>

      {/* Danger zone — owner only */}
      {isOwner ? (
        <Section title="Delete pool">
          <p className="text-sm text-ink-3">
            Permanently deletes this pool and every entry, pick, and message in it.
            This can&apos;t be undone. Type the join code{" "}
            <span className="font-mono font-bold text-ink-2">{pool.joinCode}</span> to
            confirm.
          </p>
          <form action={deletePoolAction} className="mt-3 flex gap-2">
            <input type="hidden" name="code" value={code} />
            <input
              name="confirm"
              autoComplete="off"
              placeholder={pool.joinCode}
              aria-label="Type join code to confirm deletion"
              className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 font-mono text-sm uppercase tracking-wide text-ink outline-none focus:border-live"
            />
            <button className="inline-flex h-11 shrink-0 items-center rounded-full bg-live px-5 text-sm font-semibold text-white hover:opacity-90">
              Delete
            </button>
          </form>
        </Section>
      ) : null}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
