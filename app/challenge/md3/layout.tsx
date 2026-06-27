import Link from "next/link";
import { ChallengeHero } from "../ChallengeHero";

// Match Day Pickem sub-shell: the format-specific hero above every MD3 board page
// (Home / Leaderboard / Matches / Play / entry breakdown). The back-to-app link
// sits in ink above the hero (not white-on-artwork) so it never collides with the
// title at wide widths.
export default function Md3ChallengeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3 underline-offset-2 hover:text-ink"
        >
          <span aria-hidden="true">←</span> Bracketeer
        </Link>
        <ChallengeHero format="MATCH_DAY_3_PICKEM" />
      </div>
      {children}
    </div>
  );
}
