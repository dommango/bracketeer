import { ChallengeHero } from "../ChallengeHero";

// Match Day Pickem sub-shell: the format-specific hero above every MD3 board page
// (Home / Leaderboard / Matches / Play / entry breakdown).
export default function Md3ChallengeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ChallengeHero format="MATCH_DAY_3_PICKEM" />
      {children}
    </div>
  );
}
