import { redirect } from "next/navigation";

// The standalone Scorers page was folded into the Matches tab (Scorers view).
// Keep the route as a redirect so old links / bookmarks still land in the right place.
export default async function ScorersPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/pool/${code}/matches?view=scorers`);
}
