import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

// Static changelog, newest first. The top entry's version should match
// package.json (surfaced as APP_VERSION in the footer). Add a new entry + bump
// package.json on each release.
const RELEASES: { version: string; date: string; title: string; notes: string[] }[] = [
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
      "Picks lock at the Round-of-32 kickoff; live leaderboard and bracket views.",
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
