// What a pool's billing tier unlocks. Pure + dependency-free so both server
// guards (joinPool, invite acceptance) and UI (the billing view) derive limits
// from one place. The only premium gate in this pass is member capacity: a FREE
// pool is capped; PREMIUM lifts the cap.

import type { PoolTier } from "@/generated/prisma/enums";

// A FREE pool holds up to this many members (the owner counts). PREMIUM is
// uncapped. Sized for a friend group; raise it without touching call sites.
export const FREE_MEMBER_CAP = 20;

export function isPremium(tier: PoolTier): boolean {
  return tier === "PREMIUM";
}

// The member ceiling for a tier, or null when unlimited (PREMIUM).
export function memberCap(tier: PoolTier): number | null {
  return isPremium(tier) ? null : FREE_MEMBER_CAP;
}

// Whether a pool at `currentCount` members can admit one more under its tier.
export function canAddMember(tier: PoolTier, currentCount: number): boolean {
  const cap = memberCap(tier);
  return cap === null || currentCount < cap;
}

// Slots left before the cap (null when unlimited). Never negative — a pool that
// somehow exceeds the cap (e.g. after a downgrade) reports 0, not a negative.
export function remainingSlots(tier: PoolTier, currentCount: number): number | null {
  const cap = memberCap(tier);
  if (cap === null) return null;
  return Math.max(0, cap - currentCount);
}

// User-facing message when a FREE pool is full. Centralized so the join action,
// invite acceptance, and any UI hint stay consistent.
export const POOL_FULL_MESSAGE =
  "This pool is full. The owner can upgrade to Premium to add more participants.";
