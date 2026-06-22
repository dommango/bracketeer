-- Decouple a bracket (Entry) from a pool. A bracket now carries its own
-- tournamentId + format, may have no pool (poolId nullable + movable), and the
-- system-owned "master" pools are retired in favour of the orthogonal
-- enteredChallenge opt-in flag.

-- 1. New columns. Temporarily nullable/defaulted, then backfilled from each
--    entry's current pool (every existing entry has a required pool today).
ALTER TABLE "Entry" ADD COLUMN "tournamentId" TEXT;
ALTER TABLE "Entry" ADD COLUMN "format" "PoolFormat" NOT NULL DEFAULT 'FULL_BRACKET';

UPDATE "Entry" e
SET "tournamentId" = p."tournamentId",
    "format" = p."format"
FROM "Pool" p
WHERE e."poolId" = p."id";

ALTER TABLE "Entry" ALTER COLUMN "tournamentId" SET NOT NULL;

-- 2. A bracket can now stand alone (built without a pool).
ALTER TABLE "Entry" ALTER COLUMN "poolId" DROP NOT NULL;

-- 3. Detach any solo entries from the master pool(s) so deleting the pool keeps
--    them alive as standalone brackets (they retain tournamentId + format +
--    enteredChallenge).
UPDATE "Entry" SET "poolId" = NULL
WHERE "poolId" IN (SELECT "id" FROM "Pool" WHERE "isMaster");

-- 4. Remove the system-owned master pools (cascades their memberships/snapshots/
--    messages/invites — solo mover history was never surfaced).
DELETE FROM "Pool" WHERE "isMaster";

-- 5. Retire the master-pool flag.
ALTER TABLE "Pool" DROP COLUMN "isMaster";

-- 6. Repoint Entry -> Pool from CASCADE to SET NULL (deleting a pool now orphans
--    its brackets into standalone ones rather than destroying them).
ALTER TABLE "Entry" DROP CONSTRAINT "Entry_poolId_fkey";
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_poolId_fkey"
  FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Entry -> Tournament FK + supporting index.
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Entry_tournamentId_idx" ON "Entry"("tournamentId");
