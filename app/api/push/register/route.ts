// POST   /api/push/register   — native app registers its device token (auth'd)
// DELETE /api/push/register   — native app unregisters (on logout)
//
// The Capacitor shell calls these after the user grants notification permission
// and on sign-out. Always available (even when APNs isn't configured) — storing
// a token is harmless; sendPushToPool simply never fires without keys.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/pool/access";
import { registerPushToken, removeUserPushToken } from "@/lib/push/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  // APNs device tokens are 64 hex chars today, but Apple has signalled they may
  // grow — keep a generous bound rather than pinning the exact length.
  token: z.string().min(32).max(400),
  platform: z.enum(["IOS", "ANDROID", "WEB"]).optional(),
});

const unregisterSchema = z.object({ token: z.string().min(32).max(400) });

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", 401);

  const rl = rateLimit(`push-register:${user.id}`, 30, 60_000);
  if (!rl.ok) return apiError("rate limited", 429);

  let parsed;
  try {
    parsed = registerSchema.parse(await req.json());
  } catch {
    return apiError("invalid body", 400);
  }

  await registerPushToken({ userId: user.id, token: parsed.token, platform: parsed.platform });
  return apiOk({ registered: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", 401);

  const rl = rateLimit(`push-unregister:${user.id}`, 30, 60_000);
  if (!rl.ok) return apiError("rate limited", 429);

  let parsed;
  try {
    parsed = unregisterSchema.parse(await req.json());
  } catch {
    return apiError("invalid body", 400);
  }

  // Scoped to the caller — a user can only unregister their own device token.
  await removeUserPushToken(user.id, parsed.token);
  return apiOk({ unregistered: true });
}
