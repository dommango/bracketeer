import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

// Shared site footer: tournament line, branding/credit, and a version link to the
// release notes. Rendered on the landing page and at the bottom of every pool tab.
export function Footer() {
  return (
    <footer className="mt-7 space-y-1 text-center text-[11px] text-ink-3">
      <div className="flex justify-center gap-2">
        <span>FIFA World Cup 26™</span>
        <span>·</span>
        <span>June 11 – July 19, 2026</span>
      </div>
      <div className="flex justify-center gap-2">
        <span>Bracketeer by Dom Mangonon | June 2026</span>
        <span>·</span>
        <Link href="/release-notes" className="text-pitch-dark hover:underline">
          v{APP_VERSION}
        </Link>
      </div>
      <div className="flex justify-center gap-2">
        <Link href="/terms" className="text-pitch-dark hover:underline">
          Terms
        </Link>
        <span>·</span>
        <Link href="/privacy" className="text-pitch-dark hover:underline">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
