-- CreateIndex
CREATE UNIQUE INDEX "Entry_poolId_claimEmail_key" ON "Entry"("poolId", "claimEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_poolId_userId_key" ON "Entry"("poolId", "userId");

