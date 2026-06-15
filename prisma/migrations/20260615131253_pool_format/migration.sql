-- CreateEnum
CREATE TYPE "PoolFormat" AS ENUM ('FULL_BRACKET', 'KNOCKOUT');

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "format" "PoolFormat" NOT NULL DEFAULT 'FULL_BRACKET';
