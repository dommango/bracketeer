import { getMd3MatchCenter } from "@/lib/challenge/md3-dashboard";
import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getTopScorers,
} from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { MatchCenter } from "@/app/pool/[code]/MatchCenter";
import { Scorers } from "@/app/pool/[code]/Scorers";

// Live results change at request time.
export const dynamic = "force-dynamic";

export default async function Md3ChallengeMatchesPage() {
  const user = await getSessionUser();
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [sections, scorers] = await Promise.all([
    getMd3MatchCenter(user?.id ?? null),
    getTopScorers(tournamentId),
  ]);

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <header className="px-1">
          <h1 className="font-display text-xl text-ink">Matches</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            The 24 final group-stage fixtures — the ones you predict.
          </p>
        </header>

        <MatchCenter sections={sections} hrefForMatch={(no) => `/challenge/md3/matches/${no}`} />
      </div>

      <Scorers scorers={scorers} basePath="/challenge/md3" />
    </section>
  );
}
