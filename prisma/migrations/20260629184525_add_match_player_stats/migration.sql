-- CreateTable
CREATE TABLE "MatchPlayerStats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "home" JSONB NOT NULL,
    "away" JSONB NOT NULL,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStats_matchId_key" ON "MatchPlayerStats"("matchId");

-- AddForeignKey
ALTER TABLE "MatchPlayerStats" ADD CONSTRAINT "MatchPlayerStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
