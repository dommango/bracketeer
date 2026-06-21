-- AlterTable: master pool flag (aggregates solo brackets per tournament+format)
ALTER TABLE "Pool" ADD COLUMN "isMaster" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: opt-in flag for a solo bracket to appear on the public master leaderboard
ALTER TABLE "Entry" ADD COLUMN "enteredMaster" BOOLEAN NOT NULL DEFAULT false;
