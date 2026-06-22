// Verification of the multi-bracket-per-user flow against the dev DB.
//
// PR #5 lets one person own several brackets in a pool (CSV brackets keyed by
// (poolId, claimEmail, label)). On sign-in they all bind to the same userId, so
// the pick form must target an EXPLICIT entry rather than findFirst-guessing.
// This script proves that:
//   - getUserEntries lists every bracket a user owns in a pool
//   - getUserEntry(.., entryId) scopes to one owned entry
//   - upsertUiEntry({entryId}) edits exactly that entry, leaving siblings untouched
//   - an entryId not owned by (poolId, userId) is rejected
//   - an entryId-less write is rejected when the user owns >1 bracket (ambiguous)
//
// Run with: <ENV> npx tsx scripts/verify-multi-bracket.ts

import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Submission } from "@/lib/scoring/types";
import { createPool } from "@/lib/pool/manage";
import { importSubmission } from "@/lib/pool/import";
import { claimEntriesForUser } from "@/lib/auth/claim";
import {
  upsertUiEntry,
  getUserEntry,
  getUserEntries,
} from "@/lib/pool/submit-picks";
import { resolveKnockout } from "@/lib/pool/pick-form";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

const CLAIM_EMAIL = "multi-bracket@example.com";
const OTHER_EMAIL = "multi-owner@example.com";
const POOL_NAME = "Multi-Bracket Test Pool";

function fullPicks(): Picks {
  const picks = emptyPicks();
  const letters = Object.keys(GROUPS);
  for (const g of letters) {
    picks.groupFirst[g] = GROUPS[g][0];
    picks.groupSecond[g] = GROUPS[g][1];
  }
  picks.thirdAdvance = letters.slice(0, 8).map((g) => GROUPS[g][2]);
  for (let i = 0; i < 5; i++) {
    const ko = resolveKnockout(picks);
    for (const slot of [...ko.r32, ...ko.r16, ...ko.qf, ...ko.sf, ko.final]) {
      if (slot.a && !picks.knockout[slot.matchNo]) {
        picks.knockout[slot.matchNo] = slot.a.code;
      }
    }
  }
  picks.awards = { player: "Lionel", young: "Lamine", boot: "Kylian", goal: "Cody" };
  return picks;
}

function submission(label: string, tiebreak: string): Submission {
  return {
    contestant: { name: label, email: CLAIM_EMAIL, tiebreak },
    picks: fullPicks(),
  };
}

async function cleanup() {
  await prisma.pool.deleteMany({ where: { name: POOL_NAME } });
  await prisma.user.deleteMany({ where: { email: { in: [CLAIM_EMAIL, OTHER_EMAIL] } } });
}

async function main() {
  await cleanup();

  const claimant = await prisma.user.create({
    data: { email: CLAIM_EMAIL, name: "Multi Claimant" },
  });
  const other = await prisma.user.create({
    data: { email: OTHER_EMAIL, name: "Pool Owner" },
  });

  const pool = await createPool({
    userId: other.id,
    name: POOL_NAME,
    displayName: "Owner",
  });

  // 1) Import two CSV brackets under the same email, different labels.
  const a = await importSubmission(pool.id, submission("Bold Bracket", "3"));
  const b = await importSubmission(pool.id, submission("Safe Bracket", "5"));
  check("two distinct entries imported", a.entryId !== b.entryId);
  const beforeClaim = await prisma.entry.findMany({
    where: { poolId: pool.id, claimEmail: CLAIM_EMAIL },
    select: { userId: true },
  });
  check("imported entries start unclaimed", beforeClaim.every((e) => e.userId === null));

  // 2) Claim binds both brackets to the same user.
  const claimed = await claimEntriesForUser(claimant.id, CLAIM_EMAIL);
  check("claim binds both brackets", claimed === 2, `${claimed}`);

  // 3) getUserEntries lists every owned bracket.
  const entries = await getUserEntries(pool.id, claimant.id);
  check("getUserEntries returns both brackets", entries.length === 2, `${entries.length}`);
  const labels = entries.map((e) => e.label).sort();
  check(
    "both labels present",
    labels[0] === "Bold Bracket" && labels[1] === "Safe Bracket",
    labels.join(", "),
  );

  // 4) getUserEntry(.., entryId) scopes to one owned entry.
  const scoped = await getUserEntry(pool.id, claimant.id, a.entryId);
  check("scoped getUserEntry returns the requested bracket", scoped?.entryId === a.entryId);
  check("scoped entry decodes picks", Object.keys(scoped?.picks.knockout ?? {}).length === 31);

  // 5) Edit ONE bracket by entryId; the sibling must stay byte-identical.
  const siblingBefore = await prisma.entry.findFirstOrThrow({
    where: { id: b.entryId },
    select: { label: true, tiebreak: true, importedFrom: true },
  });
  const edited: Picks = {
    ...fullPicks(),
    awards: { player: "Erling", young: "Lamine", boot: "Harry", goal: "Cody" },
  };
  const res = await upsertUiEntry({
    poolId: pool.id,
    userId: claimant.id,
    entryId: a.entryId,
    label: "Bold Bracket",
    picks: edited,
    email: CLAIM_EMAIL,
    tiebreak: "9",
  });
  check("targeted edit replaces the right entry", res.replaced === true && res.entryId === a.entryId);

  const editedRow = await prisma.entry.findFirstOrThrow({
    where: { id: a.entryId },
    select: { importedFrom: true, tiebreak: true },
  });
  check("edited entry now UI-sourced", editedRow.importedFrom === "UI");
  check("edited entry tiebreak updated", editedRow.tiebreak === "9");

  const siblingAfter = await prisma.entry.findFirstOrThrow({
    where: { id: b.entryId },
    select: { label: true, tiebreak: true, importedFrom: true },
  });
  check(
    "sibling bracket untouched",
    siblingAfter.label === siblingBefore.label &&
      siblingAfter.tiebreak === siblingBefore.tiebreak &&
      siblingAfter.importedFrom === "CSV",
  );

  // 6) An entryId-less write is ambiguous when the user owns >1 bracket.
  let ambiguousThrew = false;
  try {
    await upsertUiEntry({
      poolId: pool.id,
      userId: claimant.id,
      label: "Bold Bracket",
      picks: edited,
      email: CLAIM_EMAIL,
    });
  } catch {
    ambiguousThrew = true;
  }
  check("entryId-less write rejected when >1 bracket", ambiguousThrew);

  // 7) An entryId not owned by this (pool, user) is rejected.
  let foreignThrew = false;
  try {
    await upsertUiEntry({
      poolId: pool.id,
      userId: other.id, // owner, who has no claimed bracket
      entryId: a.entryId, // belongs to the claimant
      label: "Hijack",
      picks: edited,
      email: OTHER_EMAIL,
    });
  } catch {
    foreignThrew = true;
  }
  check("foreign entryId rejected", foreignThrew);

  // 8) Creating a first bracket whose (email, label) matches an UNCLAIMED import
  //    adopts that row instead of colliding with the unique (the CSV was imported
  //    after sign-in, so claim never bound it). The owner (no claimed bracket)
  //    stands in for such a user here.
  const orphan = await importSubmission(pool.id, {
    contestant: { name: "Owner Bracket", email: OTHER_EMAIL, tiebreak: "1" },
    picks: fullPicks(),
  });
  const orphanBefore = await prisma.entry.findFirstOrThrow({
    where: { id: orphan.entryId },
    select: { userId: true, importedFrom: true },
  });
  check("orphan import is unclaimed CSV", orphanBefore.userId === null && orphanBefore.importedFrom === "CSV");

  let adoptThrew = false;
  let adopted: { entryId: string; replaced: boolean } | null = null;
  try {
    adopted = await upsertUiEntry({
      poolId: pool.id,
      userId: other.id,
      label: "Owner Bracket", // same (email, label) as the orphan
      picks: edited,
      email: OTHER_EMAIL,
    });
  } catch {
    adoptThrew = true;
  }
  check("adopt does not throw a constraint error", !adoptThrew);
  check("adopt reuses the orphan row", adopted?.entryId === orphan.entryId && adopted?.replaced === true);
  const orphanAfter = await prisma.entry.findFirstOrThrow({
    where: { id: orphan.entryId },
    select: { userId: true, importedFrom: true },
  });
  check(
    "orphan now bound to the user as a UI bracket",
    orphanAfter.userId === other.id && orphanAfter.importedFrom === "UI",
  );

  // 9) A same-(email, label) row owned by a DIFFERENT user is a genuine clash
  //    and is refused (defensive — claim binds by email, so this is rare state).
  const { tournamentId: poolTournamentId } = await prisma.pool.findUniqueOrThrow({
    where: { id: pool.id },
    select: { tournamentId: true },
  });
  await prisma.entry.create({
    data: {
      poolId: pool.id,
      tournamentId: poolTournamentId,
      claimEmail: CLAIM_EMAIL,
      label: "Foreign Clash",
      userId: claimant.id,
      importedFrom: "CSV",
    },
  });
  let clashThrew = false;
  try {
    await upsertUiEntry({
      poolId: pool.id,
      userId: other.id, // not the owner of the clashing row
      label: "Foreign Clash",
      picks: edited,
      email: CLAIM_EMAIL, // matches the other user's row
    });
  } catch {
    clashThrew = true;
  }
  check("same-email/label row owned by another user is refused", clashThrew);

  await cleanup();

  console.log(`\nMulti-bracket: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
