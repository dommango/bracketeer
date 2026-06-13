import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// FIFA's brand typeface is proprietary; Archivo Black stands in for the chunky
// "26" display wordmark, Inter carries body/UI, JetBrains Mono the numerics.
const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const body = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Bracketeer — FIFA World Cup 2026 Pool",
  description: "Live scores, leaderboard, and chat for your FIFA World Cup 2026 bracket pool.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b6b3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
