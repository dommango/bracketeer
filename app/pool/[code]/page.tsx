import { redirect } from "next/navigation";

// Home dashboard is Tier 2. Until it ships, the canonical landing is the table.
export default async function PoolHomePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/pool/${code}/table`);
}
