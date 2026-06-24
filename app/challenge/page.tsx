import { redirect } from "next/navigation";
import { featuredGame } from "@/lib/pool/games";

export const dynamic = "force-dynamic";

// The bare /challenge index sends visitors to whichever challenge is most
// relevant right now: Match Day Pickem while it's still joinable, otherwise the
// Knockout Challenge. (Previously this page was the knockout board itself, which
// now lives at /challenge/knockout/leaderboard.)
export default function ChallengeIndexPage() {
  const featured = featuredGame();
  redirect(featured === "MATCH_DAY_3_PICKEM" ? "/challenge/md3" : "/challenge/knockout");
}
