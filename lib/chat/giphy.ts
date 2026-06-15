// Pure mapping of the Giphy API response into the small shape the chat UI needs.
// Kept route-free so it is unit-testable without network or env.

export interface GifResult {
  id: string;
  url: string; // the gif to send (fixed_width)
  previewUrl: string; // smaller thumbnail for the picker grid
  width: number;
  height: number;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Map Giphy's `data` array to GifResult[], keeping only entries with a usable
// `url`. Defensive against missing/odd fields so a malformed item is dropped
// rather than crashing the picker.
export function mapGiphyResults(json: unknown): GifResult[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  const results: GifResult[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const images = (entry as { images?: unknown }).images;
    if (!images || typeof images !== "object") continue;

    const fixedWidth = (images as { fixed_width?: unknown }).fixed_width as
      | Record<string, unknown>
      | undefined;
    const fixedWidthSmall = (images as { fixed_width_small?: unknown })
      .fixed_width_small as Record<string, unknown> | undefined;

    const url = asString(fixedWidth?.url);
    if (!url) continue;

    const previewUrl = asString(fixedWidthSmall?.url) || url;
    const id = asString((entry as { id?: unknown }).id) || url;

    results.push({
      id,
      url,
      previewUrl,
      width: asNumber(fixedWidth?.width),
      height: asNumber(fixedWidth?.height),
    });
  }
  return results;
}
