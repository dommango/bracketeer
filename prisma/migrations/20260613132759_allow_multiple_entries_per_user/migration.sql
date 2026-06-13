-- Allow more than one entry per user in a pool. Entries are now identified per
-- bracket by (poolId, claimEmail, label) rather than per user, so a user can own
-- several brackets (bound to their account on sign-in via matching claimEmail).

-- DropIndex
DROP INDEX "Entry_poolId_claimEmail_key";

-- DropIndex
DROP INDEX "Entry_poolId_userId_key";

-- CreateIndex
CREATE INDEX "Entry_poolId_userId_idx" ON "Entry"("poolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_poolId_claimEmail_label_key" ON "Entry"("poolId", "claimEmail", "label");
