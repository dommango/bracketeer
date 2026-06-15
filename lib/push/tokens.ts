// Device push-token store. The DB counterpart to the APNs sender: native apps
// register their token here after the user grants permission, and the pool
// fan-out reads tokens back out. A token is globally unique (Apple/Google issue
// one per install), so re-registering just refreshes ownership + lastSeenAt.

import { prisma } from "@/lib/db";
import type { DevicePlatform } from "@/generated/prisma/enums";

export interface RegisterTokenInput {
  userId: string;
  token: string;
  platform?: DevicePlatform;
}

// Upsert a device token for a user. If the same physical device later signs in
// as a different account, the token moves to the new user (Apple would otherwise
// deliver one user's alerts to another's lock screen).
export async function registerPushToken(input: RegisterTokenInput): Promise<void> {
  const platform = input.platform ?? "IOS";
  await prisma.pushToken.upsert({
    where: { token: input.token },
    update: { userId: input.userId, platform, lastSeenAt: new Date() },
    create: { userId: input.userId, token: input.token, platform },
  });
}

// Remove tokens after APNs reports them dead. Unscoped by design — the pruning
// path knows the token is gone from Apple's side, regardless of owner. NOT for
// the user-facing unregister endpoint (see removeUserPushToken).
export async function removePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
}

// Remove a token a user owns (the device-logout path). Scoped to userId so a
// caller can't unregister someone else's device by submitting their token.
export async function removeUserPushToken(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { token, userId } });
}

// iOS device tokens for every member of a pool (owner included via their
// membership). Used by the result fan-out. Distinct tokens only.
export async function iosTokensForPool(poolId: string): Promise<string[]> {
  const rows = await prisma.pushToken.findMany({
    where: { platform: "IOS", user: { memberships: { some: { poolId } } } },
    select: { token: true },
  });
  return [...new Set(rows.map((r) => r.token))];
}
