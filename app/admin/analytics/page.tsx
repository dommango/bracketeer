import { redirect } from "next/navigation";
import Link from "next/link";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getAdminAnalytics } from "@/lib/analytics/queries";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const admin = await getTournamentAdmin();
  if (!admin) redirect("/signin?error=forbidden");

  const data = await getAdminAnalytics();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between rounded-2xl bg-pitch p-6 text-white">
        <div>
          <p className="text-gold text-xs font-semibold uppercase tracking-wide">Admin · Analytics</p>
          <h1 className="mt-0.5 text-2xl font-bold">Platform metrics</h1>
          <p className="mt-1 text-sm text-white/70">User engagement across all pools · last {data.windowDays} days</p>
        </div>
        <Link
          href="/admin"
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
        >
          ← Admin
        </Link>
      </header>

      <div className="mt-6">
        <AnalyticsDashboard data={data} />
      </div>
    </main>
  );
}
