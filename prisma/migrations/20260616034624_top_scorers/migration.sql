-- CreateTable
CREATE TABLE "TopScorer" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER,
    "appearances" INTEGER,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopScorer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopScorer_tournamentId_rank_key" ON "TopScorer"("tournamentId", "rank");

-- AddForeignKey
ALTER TABLE "TopScorer" ADD CONSTRAINT "TopScorer_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
