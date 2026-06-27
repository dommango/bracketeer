import Link from "next/link";
import { redirect } from "next/navigation";
import { getTournamentAdmin } from "@/lib/pool/access";
import { prisma } from "@/lib/db";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { resolveKnockout, inconsistentKnockoutPicks, scoredKnockoutNumbers } from "@/lib/pool/pick-form";
import type { PickRow } from "@/lib/pool/picks";
import type { Picks } from "@/lib/scoring/types";
import { AWARD_MAP, AWARD_KEYS } from "@/lib/scoring/csv";
import { KnockoutPickForm } from "./KnockoutPickForm";

export const dynamic = "force-dynamic";

// UI labels for the player-award keys. Keys come from AWARD_KEYS (the shared,
// decoder-derived source of truth); only the human labels live here.
const AWARD_LABELS: Record<string, string> = {
  player_of_the_tournament: "Player of the Tournament",
  young_player_of_the_tournament: "Young Player",
  golden_boot: "Golden Boot",
  goal_of_the_tournament: "Goal of the Tournament",
};

const ROUND_LABEL: Record<string, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

function roundKey(matchNo: number) {
  if (matchNo >= 73 && matchNo <= 88) return "r32";
  if (matchNo >= 89 && matchNo <= 96) return "r16";
  if (matchNo >= 97 && matchNo <= 100) return "qf";
  if (matchNo >= 101 && matchNo <= 102) return "sf";
  return "final";
}

export default async function EntryPicksPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const admin = await getTournamentAdmin();
  if (!admin) redirect("/signin?error=forbidden");

  const { entryId } = await params;

  const entry = await prisma.entry.findUniqueOrThrow({
    where: { id: entryId },
    include: { picks: true, pool: { select: { name: true, joinCode: true } } },
  });

  const sub = pickRowsToSubmission(entry.picks as PickRow[]);
  const picks: Picks = sub.picks;
  const model = resolveKnockout(picks);
  const badMatchNos = new Set(inconsistentKnockoutPicks(picks));

  const allSlots = [...model.r32, ...model.r16, ...model.qf, ...model.sf, model.final];

  // Build slot data for client form
  const slotData = allSlots.map((s) => ({
    matchNo: s.matchNo,
    round: ROUND_LABEL[roundKey(s.matchNo)],
    teamA: s.a ? { code: s.a.code, name: s.a.name } : null,
    teamB: s.b ? { code: s.b.code, name: s.b.name } : null,
    currentPick: picks.knockout[s.matchNo] ?? null,
    isBad: badMatchNos.has(s.matchNo),
    isMissing: !picks.knockout[s.matchNo],
  }));

  const storedCount = scoredKnockoutNumbers().filter((n) => picks.knockout[n]).length;
  const validCount = slotData.filter((s) => s.currentPick && !s.isBad).length;

  const awardFields = AWARD_KEYS.map((key) => ({
    key,
    label: AWARD_LABELS[key] ?? key,
    value: picks.awards[AWARD_MAP[key]] ?? "",
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3">
        <Link href="/admin/entries" className="text-sm text-black/40 hover:text-black">
          ← Entry picks
        </Link>
      </div>

      <div className="mt-4 rounded-2xl bg-pitch p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          {entry.pool ? `${entry.pool.name} (${entry.pool.joinCode})` : "Standalone bracket"}
        </p>
        <h1 className="mt-1 text-xl font-bold">{entry.label}</h1>
        {entry.claimEmail && (
          <p className="mt-0.5 text-sm text-white/70">{entry.claimEmail}</p>
        )}
        <p className="mt-2 text-sm">
          Knockout picks:{" "}
          <span className={validCount < storedCount ? "font-semibold text-red-300" : "font-semibold text-green-300"}>
            {validCount}/{storedCount} valid
          </span>{" "}
          ({storedCount}/31 stored)
        </p>
        {badMatchNos.size > 0 && (
          <p className="mt-1 text-sm text-orange-300">
            {badMatchNos.size} inconsistent pick{badMatchNos.size !== 1 ? "s" : ""} (team not in that match slot)
          </p>
        )}
      </div>

      <KnockoutPickForm entryId={entryId} slots={slotData} awards={awardFields} />
    </main>
  );
}
