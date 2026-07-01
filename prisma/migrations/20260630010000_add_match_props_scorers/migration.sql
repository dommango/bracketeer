-- CreateTable
CREATE TABLE "MatchProps" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "bttsYesProb" DOUBLE PRECISION,
    "bttsNoProb" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchProps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScorerOdds" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "scoreProb" DOUBLE PRECISION NOT NULL,
    "decimal" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchScorerOdds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchProps_matchId_key" ON "MatchProps"("matchId");

-- CreateIndex
CREATE INDEX "MatchScorerOdds_matchId_idx" ON "MatchScorerOdds"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScorerOdds_matchId_playerName_key" ON "MatchScorerOdds"("matchId", "playerName");

-- AddForeignKey
ALTER TABLE "MatchProps" ADD CONSTRAINT "MatchProps_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScorerOdds" ADD CONSTRAINT "MatchScorerOdds_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
