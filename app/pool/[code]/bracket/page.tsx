import { notFound } from "next/navigation";
import { getPoolByCode, getPoolBracket } from "@/lib/pool/queries";
import { Bracket, GroupStandings } from "../Bracket";

// Bracket + group standings change as results come in.
export const dynamic = "force-dynamic";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const bracket = await getPoolBracket(pool.id);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Bracket
        </h2>
        <div className="mt-2.5">{bracket ? <Bracket view={bracket} /> : null}</div>
      </section>

      <section>
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Group standings
        </h2>
        <div className="mt-2.5">{bracket ? <GroupStandings view={bracket} /> : null}</div>
      </section>
    </div>
  );
}
