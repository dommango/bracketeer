import { notFound } from "next/navigation";
import { getPoolByCode, getGroupMatchCenter } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { MatchCenter } from "../MatchCenter";

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
  const sections = await getGroupMatchCenter(pool.id, sessionUser?.id ?? null);

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Match center</h2>
      <div className="mt-2.5">
        <MatchCenter sections={sections} code={code} />
      </div>
    </section>
  );
}
