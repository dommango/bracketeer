import type { MetadataRoute } from "next";

// Installable PWA manifest. App-shell caching is handled by the service worker
// (public/sw.js); this declares identity + icons. The maskable PNG keeps the
// mark inside Android/iOS safe zones.
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
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
