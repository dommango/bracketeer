import { ChallengeHero } from "../ChallengeHero";

// Knockout Challenge sub-shell: the format-specific hero above every knockout
// board page (Home / Leaderboard / Matches / entry profile).
export default function KnockoutChallengeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ChallengeHero format="KNOCKOUT" />
      {children}
    </div>
  );
}
