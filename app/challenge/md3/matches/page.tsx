import { getMd3MatchCenter } from "@/lib/challenge/md3-dashboard";
import { MatchCenter } from "@/app/pool/[code]/MatchCenter";

// Live results change at request time.
export const dynamic = "force-dynamic";

export default async function Md3ChallengeMatchesPage() {
  const sections = await getMd3MatchCenter();

  return (
    <section className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl text-ink">Matches</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          The 24 final group-stage fixtures — the ones you predict.
        </p>
      </header>

      {/* No per-match detail route for the challenge yet — keep cards in place. */}
      <MatchCenter sections={sections} hrefForMatch={() => "/challenge/md3/matches"} />
    </section>
  );
}
