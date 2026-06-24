import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api";

// Auth.js v5 mounts both verbs from a single handlers object. GET (session/CSRF
// reads) passes through untouched; POST (sign-in / magic-link requests, OAuth
// callbacks) is throttled per client IP so the magic-link endpoint can't be used
// to spam mail or brute-force. The limit is generous enough not to interfere with
// a normal multi-step sign-in.
export const { GET } = handlers;

// Use the RIGHTMOST x-forwarded-for hop — the one the platform edge (Railway)
// appends — not the leftmost, which is client-supplied and trivially spoofed. With
// a single hop the two coincide. Best-effort: a misconfigured proxy weakens this,
// but it's a soft brute-force guard, not an auth control.
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "anon";
  const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : "anon";
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!(await rateLimit(`auth-post:${clientIp(req)}`, 20, 60_000)).ok) {
    return apiError("Too many attempts — wait a minute and try again.", 429);
  }
  return handlers.POST(req);
}
