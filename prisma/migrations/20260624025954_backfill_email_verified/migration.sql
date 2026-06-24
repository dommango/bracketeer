-- Data migration: backfill emailVerified for pre-existing users.
--
-- Prize eligibility (and the public challenge board) now require a verified email.
-- Every existing User row was created by an authenticating sign-in (the Auth.js
-- adapter only creates users on sign-in via Google/Facebook/magic-link, all of
-- which prove email ownership), but the adapter never populated emailVerified for
-- OAuth users. Stamp those rows so current challenge entrants aren't dropped from
-- the board when the gate goes live. Idempotent and one-time (new OAuth sign-ins
-- are stamped in auth.ts going forward).
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;
