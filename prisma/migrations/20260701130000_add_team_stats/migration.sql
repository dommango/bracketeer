-- CreateTable
CREATE TABLE "TeamStat" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "played" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "cleanSheets" INTEGER NOT NULL,
    "failedToScore" INTEGER NOT NULL,
    "form" TEXT,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamStat_tournamentId_teamCode_key" ON "TeamStat"("tournamentId", "teamCode");

-- AddForeignKey
ALTER TABLE "TeamStat" ADD CONSTRAINT "TeamStat_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

