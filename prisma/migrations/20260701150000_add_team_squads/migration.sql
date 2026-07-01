-- CreateTable
CREATE TABLE "TeamSquad" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSquad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamSquad_tournamentId_teamCode_key" ON "TeamSquad"("tournamentId", "teamCode");

-- AddForeignKey
ALTER TABLE "TeamSquad" ADD CONSTRAINT "TeamSquad_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

