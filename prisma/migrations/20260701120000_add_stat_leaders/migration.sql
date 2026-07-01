-- CreateEnum
CREATE TYPE "StatCategory" AS ENUM ('ASSISTS', 'YELLOW_CARDS', 'RED_CARDS');

-- CreateTable
CREATE TABLE "StatLeader" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "category" "StatCategory" NOT NULL,
    "rank" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "appearances" INTEGER,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatLeader_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatLeader_tournamentId_category_rank_key" ON "StatLeader"("tournamentId", "category", "rank");

-- AddForeignKey
ALTER TABLE "StatLeader" ADD CONSTRAINT "StatLeader_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

