import { ChallengeBottomNav } from "./ChallengeBottomNav";
import { ChallengeRealtime } from "./ChallengeRealtime";
import { Footer } from "../Footer";

// Shared shell for the public challenge boards — the pool-style chrome (a centred
// column that clears the fixed bottom nav, the nav itself, and the periodic-refresh
// realtime). The per-challenge hero lives in each game's nested layout (md3/ and
// knockout/), which know their own format.
export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-[calc(72px+env(safe-area-inset-bottom))]">
      <ChallengeRealtime />
      <main className="mx-auto max-w-[480px] px-5 py-8">
        {children}
        <Footer />
      </main>
      <ChallengeBottomNav />
    </div>
  );
}
