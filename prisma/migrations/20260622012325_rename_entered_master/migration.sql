-- Rename: the solo opt-in flag now feeds the "Bracketeer Knockout Challenge"
-- public leaderboard. A pure column rename — values are preserved.
ALTER TABLE "Entry" RENAME COLUMN "enteredMaster" TO "enteredChallenge";
