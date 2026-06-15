-- CreateEnum
CREATE TYPE "PoolTier" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "tier" "PoolTier" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "PoolInvite" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolInvite_token_key" ON "PoolInvite"("token");

-- CreateIndex
CREATE INDEX "PoolInvite_poolId_idx" ON "PoolInvite"("poolId");

-- AddForeignKey
ALTER TABLE "PoolInvite" ADD CONSTRAINT "PoolInvite_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
