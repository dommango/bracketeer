-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "teamCode" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "age" INTEGER,
    "nationality" TEXT,
    "height" TEXT,
    "position" TEXT,
    "photoUrl" TEXT,
    "appearances" INTEGER,
    "minutes" INTEGER,
    "goals" INTEGER,
    "assists" INTEGER,
    "shots" INTEGER,
    "rating" DOUBLE PRECISION,
    "yellowCards" INTEGER,
    "redCards" INTEGER,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerProfile_tournamentId_playerName_idx" ON "PlayerProfile"("tournamentId", "playerName");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_tournamentId_externalId_key" ON "PlayerProfile"("tournamentId", "externalId");

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

