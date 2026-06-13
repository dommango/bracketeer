// Export the live HessFest 2026 pool + its 41 contestant brackets from THIS
// database (the dev `bracketeer` DB, the current source of truth) into a
// portable JSON bundle. The companion scripts/seed-hessfest.ts replays the
// bundle into any database (e.g. Railway prod) idempotently.
//
// Each bracket is exported as a decoded `Submission` -- the same shape the CSV
// import path consumes -- so re-seeding goes through the identical, byte-checked
// encoding. The export self-verifies: re-encoding every decoded submission must
// reproduce the stored Pick rows, or it aborts.
//
// The bundle holds 37 real contestant emails, so it is written under
// prisma/seed-data/ which is gitignored -- never commit it.
//
// Run with: <ENV pointing at the dev DB> npx tsx scripts/export-hessfest.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "@/lib/db";
import { pickRowsToSubmission, submissionToPickRows, type PickRow } from "@/lib/pool/picks";
import type { Submission } from "@/lib/scoring/types";

const POOL_NAME = "HessFest 2026";
const OUT_PATH = "prisma/seed-data/hessfest.json";

export interface SeedBundle {
  pool: {
    name: string;
    joinCode: string;
    tournamentSlug: string;
    settings: unknown;
    owner: { email: string; name: string | null };
  };
  // The tournament answer key, carried so the target DB's leaderboard scores
  // immediately. null when the tournament has no results entered yet.
  officialResults: unknown;
  entries: Array<{
    label: string;
    claimEmail: string | null;
    tiebreak: string | null;
    locked: boolean;
    submission: Submission;
  }>;
}

// Compare two pick-row sets as multisets (DB row order is not guaranteed).
// third_place_advancers is a SET scored by membership (score.ts uses
// `new Set(picks.thirdAdvance)`); its slot_N order comes from resolve.ts
// backtracking, which can re-pick a different-but-valid order on re-encode.
// Drop the slot key for that section; exact match everywhere else.
function rowKey(r: PickRow): string {
  const k = r.section === "third_place_advancers" ? "" : r.key;
  return [r.section, r.category, k, r.code, r.teamOrValue].join("\t");
}
function sameRows(a: PickRow[], b: PickRow[]): boolean {
  if (a.length !== b.length) return false;
  const ca = a.map(rowKey).sort();
  const cb = b.map(rowKey).sort();
  return ca.every((k, i) => k === cb[i]);
}

// A skeleton answer key (no group/knockout/third results, blank awards) carries
// no information and must NOT be exported -- seeding it onto prod would blank out
// a real key an admin may have entered. Treat such a key as "none".
function isEmptyResults(r: unknown): boolean {
  if (!r || typeof r !== "object") return true;
  const o = r as Record<string, unknown>;
  const emptyObj = (v: unknown) => !v || typeof v !== "object" || Object.keys(v as object).length === 0;
  const emptyArr = (v: unknown) => !Array.isArray(v) || v.length === 0;
  const awards = (o.awards ?? {}) as Record<string, unknown>;
  const blankAwards = Object.values(awards).every((v) => !v);
  return (
    emptyObj(o.groupFirst) &&
    emptyObj(o.groupSecond) &&
    emptyObj(o.knockout) &&
    emptyArr(o.thirdAdvance) &&
    blankAwards
  );
}

async function main() {
  const pool = await prisma.pool.findFirstOrThrow({
    where: { name: POOL_NAME },
    include: {
      tournament: { select: { slug: true, officialResults: true } },
      owner: { select: { email: true, name: true } },
      entries: {
        orderBy: { createdAt: "asc" },
        select: {
          label: true,
          claimEmail: true,
          tiebreak: true,
          locked: true,
          picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
        },
      },
    },
  });

  if (!pool.owner.email) {
    throw new Error("Pool owner has no email -- cannot upsert the owner on the target DB.");
  }

  const entries: SeedBundle["entries"] = pool.entries.map((e) => {
    const dbRows: PickRow[] = e.picks;
    const submission = pickRowsToSubmission(dbRows, {
      name: e.label,
      email: e.claimEmail ?? "",
      tiebreak: e.tiebreak ?? "",
    });
    // Parity guard: the canonical re-encoding must reproduce the DB rows
    // (third-place slot order excepted -- see rowKey).
    const reEncoded = submissionToPickRows(submission);
    if (!sameRows(dbRows, reEncoded)) {
      throw new Error(`Round-trip parity failed for entry "${e.label}" -- refusing to export a lossy bundle.`);
    }
    return {
      label: e.label,
      claimEmail: e.claimEmail,
      tiebreak: e.tiebreak,
      locked: e.locked,
      submission,
    };
  });

  const bundle: SeedBundle = {
    pool: {
      name: pool.name,
      joinCode: pool.joinCode,
      tournamentSlug: pool.tournament.slug,
      settings: pool.settings,
      owner: { email: pool.owner.email, name: pool.owner.name },
    },
    officialResults: isEmptyResults(pool.tournament.officialResults)
      ? null
      : pool.tournament.officialResults,
    entries,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(bundle, null, 2) + "\n", "utf8");

  const emails = new Set(entries.map((e) => (e.claimEmail ?? "").toLowerCase()).filter(Boolean));
  console.log(`Exported "${pool.name}" (join ${pool.joinCode}) -> ${OUT_PATH}`);
  console.log(`  ${entries.length} brackets, ${emails.size} distinct emails, all round-trip verified.`);
  console.log(`  officialResults: ${bundle.officialResults === null ? "none" : "included"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
