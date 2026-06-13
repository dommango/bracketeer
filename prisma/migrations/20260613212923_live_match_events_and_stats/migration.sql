-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'PENALTY_MISSED', 'YELLOW_CARD', 'RED_CARD', 'YELLOW_RED_CARD', 'SUBSTITUTION');

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "elapsed" INTEGER;

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "extraMinute" INTEGER,
    "type" "EventType" NOT NULL,
    "teamCode" TEXT NOT NULL,
    "playerName" TEXT,
    "assistName" TEXT,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchStats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "home" JSONB NOT NULL,
    "away" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchEvent_matchId_minute_extraMinute_type_teamCode_key" ON "MatchEvent"("matchId", "minute", "extraMinute", "type", "teamCode");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStats_matchId_key" ON "MatchStats"("matchId");

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStats" ADD CONSTRAINT "MatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
