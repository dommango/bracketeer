import type { MetadataRoute } from "next";

// Minimal installable PWA manifest (offline shell only — no live-data caching).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bracketeer × FIFA WC 2026",
    short_name: "Bracketeer",
    description: "FIFA World Cup 2026 bracket pool — live leaderboard & chat.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b6b3a",
    theme_color: "#0b6b3a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
