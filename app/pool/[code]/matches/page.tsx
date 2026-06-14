import { notFound } from "next/navigation";
import { getPoolByCode, getGroupMatchCenter, getPoolBracket } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { MatchCenter } from "../MatchCenter";
import { GroupStandings } from "../Bracket";

// Fixtures + live status change at request time.
export const dynamic = "force-dynamic";

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const sessionUser = await getSessionUser();
  const [sections, bracket] = await Promise.all([
    getGroupMatchCenter(pool.id, sessionUser?.id ?? null),
    getPoolBracket(pool.id),
  ]);

  return (
    <div className="space-y-6">
      {bracket ? (
        <section>
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            Group standings
          </h2>
          <div className="mt-2.5">
            <GroupStandings view={bracket} />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Match center</h2>
        <div className="mt-2.5">
          <MatchCenter sections={sections} code={code} />
        </div>
      </section>
    </div>
  );
}
