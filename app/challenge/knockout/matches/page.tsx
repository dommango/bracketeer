import { getSessionUser } from "@/lib/pool/access";
import { getKnockoutChallengeMatchCenter } from "@/lib/challenge/knockout-dashboard";
import { MatchCenter } from "@/app/pool/[code]/MatchCenter";

// Live results change at request time.
export const dynamic = "force-dynamic";

export default async function KnockoutChallengeMatchesPage() {
  const user = await getSessionUser();
  const sections = await getKnockoutChallengeMatchCenter(user?.id ?? null);

  return (
    <section className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl text-ink">Matches</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          The knockout bracket, Round of 32 through the final — your picks marked.
        </p>
      </header>

      {/* No per-match detail route for the challenge yet — keep cards in place. */}
      <MatchCenter sections={sections} hrefForMatch={() => "/challenge/knockout/matches"} />
    </section>
  );
}
