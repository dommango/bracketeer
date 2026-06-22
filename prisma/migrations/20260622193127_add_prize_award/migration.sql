-- CreateEnum
CREATE TYPE "ChallengeKind" AS ENUM ('KNOCKOUT', 'MATCH_DAY_3_PICKEM');

-- CreateEnum
CREATE TYPE "PrizeStatus" AS ENUM ('PENDING', 'REVIEW', 'SENT', 'SKIPPED');

-- CreateTable
CREATE TABLE "PrizeAward" (
    "id" TEXT NOT NULL,
    "challenge" "ChallengeKind" NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "entryId" TEXT,
    "userId" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "status" "PrizeStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,

    CONSTRAINT "PrizeAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrizeAward_status_idx" ON "PrizeAward"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeAward_challenge_tournamentId_key" ON "PrizeAward"("challenge", "tournamentId");
