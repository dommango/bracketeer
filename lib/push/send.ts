// Pool push fan-out. Sits between the realtime producers (notifyPool) and the
// APNs sender: resolve a pool's device tokens, send, and prune anything Apple
// reports dead. Strictly best-effort — every entry point wraps this so a push
// failure can never break the operation that triggered it (result entry, etc.).

import { pushEnabled } from "@/lib/env";
import { sendApnsBatch, type ApnsPayload } from "./apns";
import { isDeadTokenResponse } from "./apns-jwt";
import { iosTokensForPool, iosTokensForUser, removePushTokens } from "./tokens";

// Send a notification to every device subscribed to a pool. Returns the number
// of tokens delivered to (0 when push is unconfigured). Never throws.
export async function sendPushToPool(poolId: string, payload: ApnsPayload): Promise<number> {
  if (!pushEnabled) return 0;
  try {
    const tokens = await iosTokensForPool(poolId);
    if (tokens.length === 0) return 0;

    const results = await sendApnsBatch(tokens, payload);
    const dead = results.filter((r) => isDeadTokenResponse(r.status, r.reason)).map((r) => r.token);
    if (dead.length > 0) await removePushTokens(dead);

    return results.filter((r) => r.status === 200).length;
  } catch (err) {
    console.error(`sendPushToPool failed for pool ${poolId}:`, err);
    return 0;
  }
}

// Send a notification to all of a single user's devices. Same best-effort
// contract as sendPushToPool. Used to reach a challenge prize winner directly.
export async function sendPushToUser(userId: string, payload: ApnsPayload): Promise<number> {
  if (!pushEnabled) return 0;
  try {
    const tokens = await iosTokensForUser(userId);
    if (tokens.length === 0) return 0;

    const results = await sendApnsBatch(tokens, payload);
    const dead = results.filter((r) => isDeadTokenResponse(r.status, r.reason)).map((r) => r.token);
    if (dead.length > 0) await removePushTokens(dead);

    return results.filter((r) => r.status === 200).length;
  } catch (err) {
    console.error(`sendPushToUser failed for user ${userId}:`, err);
    return 0;
  }
}
