import { redirect } from "next/navigation";

// The Matches tab is now unified across both challenges (tournament-wide, no
// per-game hero or switcher) at /challenge/matches. The per-game match-detail
// pages still live under this tree (./[no]).
export default function KnockoutMatchesRedirect() {
  redirect("/challenge/matches");
}
