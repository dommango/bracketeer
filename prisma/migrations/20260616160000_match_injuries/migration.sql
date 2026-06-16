-- CreateTable
CREATE TABLE "MatchInjury" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchInjury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchInjury_matchId_key" ON "MatchInjury"("matchId");

-- AddForeignKey
ALTER TABLE "MatchInjury" ADD CONSTRAINT "MatchInjury_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
