-- CreateTable
CREATE TABLE "MatchTickets" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "minPrice" DOUBLE PRECISION,
    "currency" TEXT,
    "url" TEXT,
    "priceSource" TEXT,
    "source" TEXT NOT NULL,
    "raw" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchTickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchTickets_matchId_key" ON "MatchTickets"("matchId");

-- AddForeignKey
ALTER TABLE "MatchTickets" ADD CONSTRAINT "MatchTickets_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
