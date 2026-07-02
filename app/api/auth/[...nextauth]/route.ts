import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromForwardedFor } from "@/lib/rate-limit-core";
import { apiError } from "@/lib/api";

// Auth.js v5 mounts both verbs from a single handlers object. GET (session/CSRF
// reads) passes through untouched; POST (sign-in / magic-link requests, OAuth
// callbacks) is throttled per client IP so the magic-link endpoint can't be used
// to spam mail or brute-force. The limit is generous enough not to interfere with
// a normal multi-step sign-in.
export const { GET } = handlers;

export async function POST(req: NextRequest): Promise<Response> {
  // Rightmost-hop IP keying — see clientIpFromForwardedFor for why leftmost is unsafe.
  const ip = clientIpFromForwardedFor(req.headers.get("x-forwarded-for"));
  if (!(await rateLimit(`auth-post:${ip}`, 20, 60_000)).ok) {
    return apiError("Too many attempts — wait a minute and try again.", 429);
  }
  return handlers.POST(req);
}
