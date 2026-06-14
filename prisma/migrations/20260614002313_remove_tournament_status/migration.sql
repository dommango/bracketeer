-- Tournament.status was never transitioned off its UPCOMING default; lifecycle
-- status is now derived from startsAt + the final's result (see deriveTournamentStatus).
ALTER TABLE "Tournament" DROP COLUMN "status";

DROP TYPE "TournamentStatus";
