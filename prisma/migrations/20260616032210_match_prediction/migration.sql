-- CreateTable
CREATE TABLE "MatchPrediction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homePercent" DOUBLE PRECISION,
    "drawPercent" DOUBLE PRECISION,
    "awayPercent" DOUBLE PRECISION,
    "advice" TEXT,
    "homeForm" TEXT,
    "awayForm" TEXT,
    "h2h" JSONB,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_matchId_key" ON "MatchPrediction"("matchId");

-- AddForeignKey
ALTER TABLE "MatchPrediction" ADD CONSTRAINT "MatchPrediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
