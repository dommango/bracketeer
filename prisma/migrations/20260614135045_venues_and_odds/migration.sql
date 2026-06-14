-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "city" TEXT,
ADD COLUMN     "venue" TEXT;

-- CreateTable
CREATE TABLE "MatchOdds" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeWinProb" DOUBLE PRECISION NOT NULL,
    "drawProb" DOUBLE PRECISION NOT NULL,
    "awayWinProb" DOUBLE PRECISION NOT NULL,
    "raw" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchOdds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchOdds_matchId_key" ON "MatchOdds"("matchId");

-- AddForeignKey
ALTER TABLE "MatchOdds" ADD CONSTRAINT "MatchOdds_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
