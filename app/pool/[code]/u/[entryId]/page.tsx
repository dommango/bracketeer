import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getProfile } from "@/lib/pool/queries";
import { Profile } from "../../Profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ code: string; entryId: string }>;
}) {
  const { code, entryId } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const profile = await getProfile(pool.id, entryId);
  if (!profile) notFound();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Player profile
        </h2>
        <Link
          href={`/pool/${code}`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
        >
          ← Leaderboard
        </Link>
      </div>
      <Profile profile={profile} />
    </section>
  );
}
