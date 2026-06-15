// GET /api/giphy/search — server-side Giphy proxy that keeps GIPHY_API_KEY off
// the client. Returns a small mapped result shape for the chat GIF picker.
// Signed-in members only; degrades to an empty result list when Giphy is unset
// or the upstream call fails (never 500s the chat UI).

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/pool/access";
import { env, giphyEnabled } from "@/lib/env";
import { mapGiphyResults } from "@/lib/chat/giphy";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(100).default(""),
  offset: z.coerce.number().int().min(0).max(200).default(0),
});

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
const LIMIT = 24;

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return apiError("Sign in to search GIFs", 401);

  // Defensive: the UI hides the button when Giphy is disabled.
  if (!giphyEnabled) return apiOk({ results: [] });

  let parsed: z.infer<typeof querySchema>;
  try {
    parsed = querySchema.parse({
      q: req.nextUrl.searchParams.get("q") ?? "",
      offset: req.nextUrl.searchParams.get("offset") ?? 0,
    });
  } catch (err) {
    return apiError(`Invalid query: ${(err as Error).message}`, 400);
  }

  const q = parsed.q.trim();
  const endpoint = q ? "search" : "trending";
  const params = new URLSearchParams({
    api_key: env.GIPHY_API_KEY,
    limit: String(LIMIT),
    offset: String(parsed.offset),
    rating: "pg-13",
    bundle: "messaging_non_clips",
  });
  if (q) params.set("q", q);

  try {
    const res = await fetch(`${GIPHY_BASE}/${endpoint}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return apiOk({ results: [] });
    const json = await res.json();
    return apiOk({ results: mapGiphyResults(json) });
  } catch (err) {
    console.error("Giphy search failed:", err);
    return apiOk({ results: [] });
  }
}
