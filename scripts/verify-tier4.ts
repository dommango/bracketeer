// End-to-end verification of the Tier-4 multi-tenant flows against the dev DB:
//   create a pool -> join by code -> submit a UI bracket -> edit it -> lock it.
// Asserts membership wiring, join-code format, UI-entry persistence + round-trip,
// edit-in-place (no duplicate entry), and the lock guard.
//
// Run with: <ENV> npx tsx scripts/verify-tier4.ts

import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks } from "@/lib/scoring/types";
import { createPool, joinPool } from "@/lib/pool/manage";
import { upsertUiEntry, getUserEntry } from "@/lib/pool/submit-picks";
import { resolveKnockout, pickFormProgress } from "@/lib/pool/pick-form";
import { isValidJoinCode } from "@/lib/pool/join-code";
import { recomputePool } from "@/lib/pool/scoring";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

const OWNER_EMAIL = "tier4-owner@example.com";
const MEMBER_EMAIL = "tier4-member@example.com";
const POOL_NAME = "Tier4 Test Pool";

// A fully-completed bracket: 1st/2nd from group order, first 8 thirds, "a" side
// of every knockout match (cascaded forward).
function fullPicks(): Picks {
  const picks = emptyPicks();
  const letters = Object.keys(GROUPS);
  for (const g of letters) {
    picks.groupFirst[g] = GROUPS[g][0];
    picks.groupSecond[g] = GROUPS[g][1];
  }
  picks.thirdAdvance = letters.slice(0, 8).map((g) => GROUPS[g][2]);
  // Fill one stage per pass (winners cascade forward). The "a" side is always a
  // resolved feeder, so picking it reaches all 31 scored matches even when a
  // third-place slot resolves to null under the greedy resolver.
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

async function cleanup() {
  await prisma.pool.deleteMany({ where: { name: POOL_NAME } });
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, MEMBER_EMAIL] } } });
}

async function main() {
  await cleanup();

  const owner = await prisma.user.create({
    data: { email: OWNER_EMAIL, name: "Tier4 Owner" },
  });
  const member = await prisma.user.create({
    data: { email: MEMBER_EMAIL, name: "Tier4 Member" },
  });

  // 1) Create a pool.
  const created = await createPool({
    userId: owner.id,
    name: POOL_NAME,
    displayName: "Owner Dom",
  });
  check("createPool returns a valid join code", isValidJoinCode(created.joinCode), created.joinCode);

  const ownerMembership = await prisma.membership.findFirst({
    where: { poolId: created.id, userId: owner.id },
  });
  check("owner is enrolled as OWNER", ownerMembership?.role === "OWNER");
  check("owner display name persisted", ownerMembership?.displayName === "Owner Dom");

  // 2) Join by code.
  const joined = await joinPool({
    userId: member.id,
    joinCode: created.joinCode.toLowerCase(), // exercise normalization
    displayName: "Member Sam",
  });
  check("joinPool resolves the pool", joined.poolId === created.id);
  const memberMembership = await prisma.membership.findFirst({
    where: { poolId: created.id, userId: member.id },
  });
  check("member is enrolled as MEMBER", memberMembership?.role === "MEMBER");

  // joining again is idempotent (no duplicate membership / no throw)
  await joinPool({ userId: member.id, joinCode: created.joinCode });
  const memberCount = await prisma.membership.count({
    where: { poolId: created.id, userId: member.id },
  });
  check("re-joining is idempotent", memberCount === 1);

  // 3) Submit a UI bracket.
  const picks = fullPicks();
  check("fullPicks is a complete bracket", pickFormProgress(picks).complete);

  const submit1 = await upsertUiEntry({
    poolId: created.id,
    userId: member.id,
    label: "Member Sam",
    picks,
    email: MEMBER_EMAIL,
    tiebreak: "4",
  });
  check("first submit creates an entry", submit1.replaced === false);

  const entry = await prisma.entry.findFirstOrThrow({
    where: { id: submit1.entryId },
    include: { picks: true },
  });
  check("entry is marked UI-sourced", entry.importedFrom === "UI");
  check("entry bound to member", entry.userId === member.id);
  check("pick rows persisted", entry.picks.length > 50, `${entry.picks.length} rows`);

  // round-trip back to a Picks object
  const reread = await getUserEntry(created.id, member.id);
  check(
    "group winners round-trip",
    reread?.picks.groupFirst["A"] === GROUPS.A[0] && reread?.picks.groupSecond["A"] === GROUPS.A[1],
  );
  check("knockout picks round-trip", Object.keys(reread?.picks.knockout ?? {}).length === 31);
  check("tiebreak round-trips", reread?.tiebreak === "4");

  // recompute should run cleanly with the UI entry present
  const board = await recomputePool(created.id);
  check("recompute includes the UI entry", Array.isArray(board) && board.length >= 1);

  // 4) Edit in place — change a knockout pick, no duplicate entry.
  const edited: Picks = {
    ...picks,
    knockout: { ...picks.knockout, 104: resolveKnockout(picks).final.b?.code ?? picks.knockout[104] },
  };
  const submit2 = await upsertUiEntry({
    poolId: created.id,
    userId: member.id,
    label: "Member Sam",
    picks: edited,
    email: MEMBER_EMAIL,
    tiebreak: "2",
  });
  check("second submit replaces in place", submit2.replaced === true && submit2.entryId === submit1.entryId);
  const entryCount = await prisma.entry.count({ where: { poolId: created.id, userId: member.id } });
  check("no duplicate entry after edit", entryCount === 1);

  // 5) Lock guard.
  await prisma.entry.update({ where: { id: submit1.entryId }, data: { locked: true } });
  let threw = false;
  try {
    await upsertUiEntry({
      poolId: created.id,
      userId: member.id,
      label: "Member Sam",
      picks,
      email: MEMBER_EMAIL,
    });
  } catch {
    threw = true;
  }
  check("locked entry rejects edits", threw);

  await cleanup();

  console.log(`\nTier 4: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
