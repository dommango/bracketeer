-- Feedback → central Notion DB outbox columns.
ALTER TABLE "Feedback" ADD COLUMN "notionPageId" TEXT, ADD COLUMN "notionSyncedAt" TIMESTAMP(3), ADD COLUMN "notionSyncAttempts" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "notionLastError" TEXT;

-- Rows that already have a back-link are considered synced (old inline path).
-- Rows with a NULL notionUrl are genuinely lost and will be pushed by the reconciler.
UPDATE "Feedback" SET "notionSyncedAt" = "createdAt" WHERE "notionUrl" IS NOT NULL;

-- Partial index the reconciler scans: only unsynced rows, ordered by age.
CREATE INDEX "Feedback_notion_unsynced_idx" ON "Feedback"("createdAt") WHERE "notionSyncedAt" IS NULL;
