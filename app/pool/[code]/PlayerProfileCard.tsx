import type { PlayerDetail } from "@/lib/pool/player-detail";

// Bio + tournament stat line for the player drill-down page (API-Football /players).
// Presentational only; renders nothing until the players poll has a profile for this
// name. Shared by the pool and the two public-challenge player pages.
type Profile = PlayerDetail["profile"];

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display text-lg tabular-nums text-ink">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">{label}</span>
    </div>
  );
}

export function PlayerProfileCard({ profile }: { profile: Profile }) {
  if (!profile) return null;

  const meta: { label: string; value: string }[] = [];
  if (profile.position) meta.push({ label: "Position", value: profile.position });
  if (profile.age != null) meta.push({ label: "Age", value: String(profile.age) });
  if (profile.nationality) meta.push({ label: "Nationality", value: profile.nationality });
  if (profile.height) meta.push({ label: "Height", value: profile.height });

  // A stat line is worth showing once the player has actually appeared.
  const hasStats = (profile.appearances ?? 0) > 0 || (profile.minutes ?? 0) > 0;

  if (meta.length === 0 && !hasStats) return null;

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Profile</h2>
      <div className="mt-2.5 space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        {meta.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {meta.map((m) => (
              <Meta key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        ) : null}
        {hasStats ? (
          <div className="grid grid-cols-4 gap-2 border-t border-line-soft pt-3 sm:grid-cols-6">
            <StatCell label="Apps" value={profile.appearances ?? 0} />
            <StatCell label="Mins" value={profile.minutes ?? 0} />
            <StatCell label="Goals" value={profile.goals ?? 0} />
            <StatCell label="Assists" value={profile.assists ?? 0} />
            {profile.rating != null ? <StatCell label="Rating" value={profile.rating.toFixed(1)} /> : null}
            {profile.shots != null ? <StatCell label="Shots" value={profile.shots} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
