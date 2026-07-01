import type { AdminAnalytics } from "@/lib/analytics/queries";
import type { AnalyticsEventType } from "@/generated/prisma/enums";
import type { DayBucket } from "@/lib/analytics/aggregate";
import { LABEL } from "@/lib/ui/labels";

// Friendly names for the raw event enum, used in the breakdown.
const TYPE_LABEL: Record<AnalyticsEventType, string> = {
  SIGN_IN: "Sign-ins",
  SIGN_UP: "Sign-ups",
  POOL_CREATE: "Pools created",
  POOL_JOIN: "Pool joins",
  ENTRY_SUBMIT: "Brackets submitted",
  CHAT_MESSAGE: "Chat messages",
  REACTION: "Reactions",
};

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// A short axis label for a UTC day-key ("2026-06-30" → "Jun 30").
function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
      <p className={LABEL}>{label}</p>
      <p className="mt-1.5 font-display text-3xl tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-4">{hint}</p> : null}
    </div>
  );
}

// A zero-filled daily series as vertical bars. Heights are relative to the
// series max; days with no activity render as a faint baseline tick. Sparse
// axis labels (first / middle / last) keep 30 columns readable.
function DailyBars({ data, color }: { data: DayBucket[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const mid = Math.floor(data.length / 2);
  return (
    <div>
      <div className="flex h-32 items-end gap-px">
        {data.map((d) => (
          <div
            key={d.date}
            title={`${shortDate(d.date)}: ${fmt(d.count)}`}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 1.5)}%`,
              background: d.count > 0 ? color : "var(--color-line)",
              opacity: d.count > 0 ? 1 : 0.6,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium text-ink-4">
        <span>{data.length ? shortDate(data[0].date) : ""}</span>
        <span>{data.length ? shortDate(data[mid].date) : ""}</span>
        <span>{data.length ? shortDate(data[data.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}

// A horizontal labelled bar (event-type breakdown, top pools).
function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-36 shrink-0 truncate text-sm text-ink">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
        <span
          className="block h-full rounded-full"
          style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, background: color }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-ink-2">
        {fmt(count)}
      </span>
    </div>
  );
}

function Section({ title, children, note }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{title}</h2>
      {note ? <p className="mt-1 px-1 text-[11px] text-ink-4">{note}</p> : null}
      <div className="mt-2.5 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        {children}
      </div>
    </section>
  );
}

export function AnalyticsDashboard({ data }: { data: AdminAnalytics }) {
  const { totals, newUsers, active, eventsPerDay, activeUsersPerDay, byType, topPools, windowDays } = data;
  const typeMax = Math.max(1, ...byType.map((t) => t.count));
  const poolMax = Math.max(1, ...topPools.map((p) => p.count));

  return (
    <div className="space-y-7">
      {/* ACTIVE USERS */}
      <Section title="Active users" note="Distinct signed-in users with any tracked action in the trailing window.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Daily" value={fmt(active.dau)} hint="last 24h" />
          <StatCard label="Weekly" value={fmt(active.wau)} hint="last 7 days" />
          <StatCard label="Monthly" value={fmt(active.mau)} hint="last 30 days" />
          <StatCard label="Stickiness" value={`${active.stickiness}%`} hint="DAU / MAU" />
        </div>
        <div className="mt-4">
          <p className={LABEL}>Active users per day</p>
          <div className="mt-2">
            <DailyBars data={activeUsersPerDay} color="var(--color-pitch)" />
          </div>
        </div>
      </Section>

      {/* ENGAGEMENT VOLUME */}
      <Section title={`Engagement events · last ${windowDays} days`}>
        <DailyBars data={eventsPerDay} color="var(--color-gold)" />
        {byType.length > 0 ? (
          <div className="mt-5 space-y-2">
            <p className={LABEL}>By type</p>
            {byType.map((t) => (
              <HBar
                key={t.type}
                label={TYPE_LABEL[t.type] ?? t.type}
                count={t.count}
                max={typeMax}
                color="var(--color-pitch)"
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-4">
            No engagement events recorded yet — metrics populate as users sign in and play.
          </p>
        )}
      </Section>

      {/* MOST ACTIVE POOLS */}
      {topPools.length > 0 ? (
        <Section title="Most active pools" note="Pools ranked by event volume in the window.">
          <div className="space-y-2">
            {topPools.map((p) => (
              <HBar key={p.poolId} label={p.name} count={p.count} max={poolMax} color="var(--color-gold)" />
            ))}
          </div>
        </Section>
      ) : null}

      {/* TOTALS */}
      <Section title="All-time totals">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Users" value={fmt(totals.users)} hint={`+${fmt(newUsers.last7d)} this week`} />
          <StatCard label="Pools" value={fmt(totals.pools)} />
          <StatCard label="Brackets" value={fmt(totals.entries)} />
          <StatCard label="Events logged" value={fmt(totals.events)} />
        </div>
      </Section>
    </div>
  );
}
