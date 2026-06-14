import { redirect } from "next/navigation";

// The standalone bracket page was merged into Fixtures (Knockouts view). Keep the
// route as a permanent redirect so old links / bookmarks still land in the right place.
export default async function BracketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/pool/${code}/matches?view=knockouts`);
}
