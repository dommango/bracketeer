import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PwaClient from "./PwaClient";
import { FeedbackWidget } from "./feedback/FeedbackWidget";

// FIFA's brand typeface is proprietary; Archivo Black stands in for the chunky
// "26" display wordmark, Inter carries body/UI, JetBrains Mono the numerics.
const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const body = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Bracketeer × FIFA WC 2026",
  description: "Live scores, leaderboard, and chat for your FIFA World Cup 2026 bracket pool.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bracketeer",
  // Standalone home-screen launch on iOS, with a translucent status bar so the
  // dark-green chrome runs edge to edge (paired with viewportFit: "cover").
  appleWebApp: {
    capable: true,
    title: "Bracketeer",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b6b3a",
  width: "device-width",
  initialScale: 1,
  // Extend under the notch / home indicator; safe-area insets are handled in CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        {children}
        <FeedbackWidget />
        <PwaClient />
      </body>
    </html>
  );
}
