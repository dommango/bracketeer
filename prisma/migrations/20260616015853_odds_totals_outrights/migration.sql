-- AlterTable
ALTER TABLE "MatchOdds" ADD COLUMN     "overProb" DOUBLE PRECISION,
ADD COLUMN     "totalLine" DOUBLE PRECISION,
ADD COLUMN     "underProb" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TeamOutright" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "winProb" DOUBLE PRECISION NOT NULL,
    "decimal" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamOutright_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamOutright_tournamentId_teamCode_key" ON "TeamOutright"("tournamentId", "teamCode");

-- AddForeignKey
ALTER TABLE "TeamOutright" ADD CONSTRAINT "TeamOutright_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
