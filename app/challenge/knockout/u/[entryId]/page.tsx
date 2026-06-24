import { notFound } from "next/navigation";
import { getKnockoutChallengeProfile } from "@/lib/challenge/knockout-dashboard";
import { Profile } from "@/app/pool/[code]/Profile";

export const dynamic = "force-dynamic";

export default async function KnockoutChallengeEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const profile = await getKnockoutChallengeProfile(entryId);
  if (!profile) notFound();

  return <Profile profile={profile} format="KNOCKOUT" />;
}
