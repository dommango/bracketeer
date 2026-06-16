-- CreateTable
CREATE TABLE "GoalscorerOutright" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "winProb" DOUBLE PRECISION NOT NULL,
    "decimal" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalscorerOutright_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalscorerOutright_tournamentId_playerName_key" ON "GoalscorerOutright"("tournamentId", "playerName");

-- AddForeignKey
ALTER TABLE "GoalscorerOutright" ADD CONSTRAINT "GoalscorerOutright_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
