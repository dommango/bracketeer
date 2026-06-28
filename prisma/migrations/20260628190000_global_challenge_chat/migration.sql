-- Global challenge chat: a ChatMessage can now be scoped to a tournament (the
-- shared challenge chat) instead of a pool. Relax poolId to nullable and add a
-- nullable tournamentId with its FK + index. Additive and non-breaking: existing
-- pool messages keep their poolId and are unaffected.

-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "poolId" DROP NOT NULL;
ALTER TABLE "ChatMessage" ADD COLUMN "tournamentId" TEXT;

-- CreateIndex
CREATE INDEX "ChatMessage_tournamentId_createdAt_idx" ON "ChatMessage"("tournamentId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one scope: every message is pool-scoped XOR tournament-scoped. Defense
-- in depth so a malformed insert can't create an unscoped or dual-scoped row.
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_one_scope" CHECK (("poolId" IS NULL) <> ("tournamentId" IS NULL));
