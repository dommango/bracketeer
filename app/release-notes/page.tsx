import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

// Static changelog, newest first. The top entry's version should match
// package.json (surfaced as APP_VERSION in the footer). Add a new entry + bump
// package.json on each release.
const RELEASES: { version: string; date: string; title: string; notes: string[] }[] = [
  {
    version: "0.15.0",
    date: "June 30, 2026",
    title: "More betting markets & player ratings",
    notes: [
      "New markets on every knockout match: an Asian-handicap (spread) line, both-teams-to-score, and an anytime-goalscorer board with flags.",
      "The Matches → Insights tab now has a “Most likely to score today” module, alongside the upset radar, Golden Boot and title odds.",
      "Finished fixtures now show player ratings and a Player of the Match.",
      "Fixed the venue and kickoff time shown for a few Round of 32 matches.",
    ],
  },
  {
    version: "0.14.0",
    date: "June 27, 2026",
    title: "One home for Match Day Pickem and the Knockout Challenge",
    notes: [
      "Match Day Pickem and the Knockout Challenge now share one set of tabs — flip between the two games with a tap instead of hunting for the right screen.",
      "Picks: make your scoreline predictions and build your knockout bracket from a single Picks tab.",
      "Matches: one tournament-wide view — group standings and fixtures, the knockout bracket, scorers and odds — with both your scoreline and winner picks marked.",
      "The live scoreboard and match-updates feed now stay the same across both games, so “what’s on now” doesn’t change when you switch.",
      "Your pick count now shows what you’ve predicted, what’s still open, and what you missed after kickoff.",
      "Plus a refreshed home with a cycling game spotlight, tappable game cards, and wider, roomier screens.",
    ],
  },
  {
    version: "0.13.0",
    date: "June 26, 2026",
    title: "Match Day Pickem home & leaderboard polish",
    notes: [
      "Your Match Day Pickem home now leads with the live scores, then a match-updates feed (goals, red cards and full-times), with your standing below — so the action comes first.",
      "The pick page header is tighter: a single line with the Match Day 3 dates and how points are scored.",
      "You can now set a Leaderboard display name in account settings to choose how you appear on the Match Day Pickem leaderboard.",
      "Renamed the remaining “Board” labels to “Leaderboard” across the challenge screens.",
    ],
  },
  {
    version: "0.12.0",
    date: "June 26, 2026",
    title: "Build your knockout bracket — desktop tree & early picks",
    notes: [
      "Knockout and Challenge brackets are open early: start building now against the qualifiers already decided. Matchups still being decided show as TBD and unlock as the last group results land.",
      "Heads-up while seeding finalises: if a result changes one of your matchups, that pick clears — so check back before kickoff.",
      "The bracket builder now shows as a proper left-to-right bracket tree on desktop, with winners flowing rightward as you tap; the mobile layout is unchanged.",
      "Every odds surface — title odds, Golden Boot odds, the scorer board and a match’s win-probability — now shows when it was last updated.",
      "Polished the knockout pick cards, bracket and match cards to match the rest of the app.",
    ],
  },
  {
    version: "0.11.0",
    date: "June 26, 2026",
    title: "Match Day Pickem, full tournament view",
    notes: [
      "The Match Day Pickem Matches tab now covers the whole tournament — group standings on top, then every group and knockout fixture (browse by group, day, or city), plus Scorers and odds — not just the 24 pickem games.",
      "Your Match Day Pickem home now leads with live scores and group-standings cards, matching the pool home layout.",
      "Fixed: your predicted scoreline now reads in the same home–away order as the match, so a correct pick no longer looks wrong against the result.",
      "Win-probability bars now show the real favorite — corrected a home/away mix-up that flipped the odds on neutral-venue matches.",
      "Group-stage form now reads in true kickoff order across every standings table.",
      "Challenge polish: the “Board” tab is now “Leaderboard”, the pick page leads with the prize and a “how points work” note, and closed fixtures sit collapsed at the top so the games you can still pick lead.",
    ],
  },
  {
    version: "0.10.0",
    date: "June 23, 2026",
    title: "Home hub & public challenges",
    notes: [
      "The home screen now promotes both public games side by side — Match Day Pickem and the Knockout Challenge — each with its own card, and the Knockout Challenge shows the Round of 32 countdown.",
      "“Build your bracket” is now clearly the Knockout Challenge entry: build your knockout bracket and top the global leaderboard.",
      "New here? If you’re not in a pool yet, the home screen walks you through starting your own Knockout Stage Pool to play with friends.",
      "Group standings no longer show a team as “eliminated” while its group is still being played — your picks stay in contention until the results are final.",
      "Match Day Pickem now spells out the dates (June 24–27) and that picks close at the start of each match.",
      "Added Terms of Service and Privacy Policy pages, linked from the footer and the sign-in screen.",
    ],
  },
  {
    version: "0.9.0",
    date: "June 21, 2026",
    title: "Solo brackets & group overlay",
    notes: [
      "Play solo: build your own knockout bracket without starting a pool, and opt it into the Knockout Challenge to compete with everyone who enters.",
      "Home group standings now overlay your bracket — a 'You' column shows your predicted finishing order beside the live table.",
      "See exactly where your live points come from: each pick shows what it's earning (+3 correct position, +1 right team / wrong position), summed into a per-group total.",
      "Third-place standings now show full team names, mark your best-3rd advancer picks, and draw the top-8 qualification cut-off line.",
      "Form chips now show each team's results in real match order, not grouped by result.",
    ],
  },
  {
    version: "0.8.0",
    date: "June 18, 2026",
    title: "Stadiums & projections",
    notes: [
      "Road to the Round of 32: for each host stadium, see the teams most likely to play there, drawn as probability bars from live standings and odds.",
      "Stadium pages now show live scorecards with tappable venue links and live match chat, listed in kickoff order.",
      "Richer live matches: in-play stats and head-to-head history on every fixture.",
      "Tidier Matches view — finished days fold into a single 'Previous days' section, and the Round of 32 countdown now greets you at sign-in.",
      "Cleaner win-probability bars: the draw sits in the middle, they hide once a match is final, and they're clearly labeled while live.",
      "Fixes: standings no longer read '0 points to the spot above' when you're tied, plus a footer with release notes on every tab.",
    ],
  },
  {
    version: "0.7.0",
    date: "June 17, 2026",
    title: "Navigation refresh",
    notes: [
      "Streamlined three-tab navigation: Home, Brackets, and Matches (Scorers now lives under Matches).",
      "Tap any team or player to open a dedicated drill-down page.",
      "Redesigned Home: chat, live scorecards, and group standings up top, with a quick link to the day's fixtures.",
      "Upset Watch moved to Matches → Odds; pool pick consensus moved to the Brackets hub.",
      "More accurate odds: corrected home/away win probabilities and consensus pricing across bookmakers.",
    ],
  },
  {
    version: "0.6.0",
    date: "June 16, 2026",
    title: "Match intelligence & odds",
    notes: [
      "Match Insights on every fixture: model predictions, recent form, and head-to-head records.",
      "Betting markets: win probabilities, Over/Under totals, tournament-winner and Golden Boot odds.",
      "Live Golden Boot leaderboard with inline goalscorers and cards on the scoreboard.",
      "Pre-match upset radar plus injury and suspension reports.",
      "Match tickets — prices and buy links — and live scores refreshed every minute.",
    ],
  },
  {
    version: "0.5.0",
    date: "June 15, 2026",
    title: "iOS app foundation",
    notes: [
      "Installable PWA: home-screen icons, offline app shell, and standalone display.",
      "Native push notifications (Apple) for knockout results, behind the scenes.",
      "Capacitor iOS shell groundwork for the upcoming App Store build.",
    ],
  },
  {
    version: "0.4.0",
    date: "June 15, 2026",
    title: "Pools that scale",
    notes: [
      "Premium pool tier lifts the free member cap.",
      "Stripe checkout on the web for upgrading a pool.",
      "Invite friends by email or shareable link, beyond the join code.",
    ],
  },
  {
    version: "0.3.0",
    date: "June 15, 2026",
    title: "Knockout Challenge",
    notes: [
      "Standalone knockout-bracket game: pick winners once the last 32 are set.",
      "Picks lock at the Round of 32 kickoff; live leaderboard and bracket views.",
    ],
  },
  {
    version: "0.2.0",
    date: "June 15, 2026",
    title: "Bracketeer platform",
    notes: [
      "Rebranded to Bracketeer — HessFest is now one pool on the platform.",
      "Choose your game type when creating a pool.",
    ],
  },
];

// Fail loudly in dev/build if a package.json bump forgot a matching entry — the
// footer reads APP_VERSION, so a missing top entry would show a version with no
// notes to users.
if (process.env.NODE_ENV !== "production" && RELEASES[0]?.version !== APP_VERSION) {
  throw new Error(
    `release-notes: top entry ${RELEASES[0]?.version} != package version ${APP_VERSION} — add a RELEASES entry.`,
  );
}

export default function ReleaseNotesPage() {
  return (
    <main className="mx-auto max-w-[480px] px-5 pb-16 pt-12">
      <Link
        href="/"
        className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
      >
        ← Back
      </Link>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
          Release notes
        </p>
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">What&rsquo;s new</h1>
        <p className="mt-2 text-[13px] text-ink-3">
          You&rsquo;re on <span className="font-semibold text-ink-2">v{APP_VERSION}</span>.
        </p>

        <ol className="mt-5 space-y-5">
          {RELEASES.map((r) => (
            <li key={r.version} id={`v${r.version}`} className="scroll-mt-12">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg text-ink">
                  v{r.version}
                  <span className="ml-2 text-[13px] font-normal text-ink-3">{r.title}</span>
                </h2>
                <span className="shrink-0 text-[11px] text-ink-3">{r.date}</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-3">
                {r.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
