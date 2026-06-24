import Link from "next/link";

export const dynamic = "force-dynamic";

// Official Prize Rules for the public challenges. Free-to-enter, skill-based
// contest (not a lottery): no purchase or payment is required to enter or win.
// Figures mirror lib/challenge/prizes-config.ts (MD3 flat $50; Knockout $1 per
// eligible entrant, floor $50, cap $250; USD). Promoter: Dom Mangonon. Not a
// substitute for legal review before a public launch.
const LAST_UPDATED = "June 2026";

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "No purchase necessary",
    body: [
      "The Bracketeer prize challenges are free to enter. No purchase or payment of any kind is required to enter or to win, and a purchase will not improve your chances of winning. These challenges are games of skill — winners are determined by the accuracy of their predictions, not by chance.",
    ],
  },
  {
    heading: "Promoter",
    body: [
      "These challenges are run by Dom Mangonon (“the Promoter”), the operator of Bracketeer. They are not sponsored, endorsed, or administered by, or associated with, FIFA, any football association, any team, Apple, Google, or any other platform. Contact: dommango@gmail.com.",
    ],
  },
  {
    heading: "Eligibility",
    body: [
      "Open to individuals who are at least 18 years old at the time of entry. Void where prohibited or restricted by law. By entering, you confirm you are 18 or older and that participation is lawful where you live.",
      "Employees and immediate family of the Promoter are not eligible to win. A verified email address is required to enter. Creating multiple or duplicate accounts to enter more than your allowed entries will disqualify all of your entries.",
    ],
  },
  {
    heading: "How to enter",
    body: [
      "Sign in to Bracketeer, complete a challenge entry, and opt in:",
      "• Match Day Pickem: predict the exact scoreline of all 24 final group-stage matches. One entry per person.",
      "• Knockout Challenge: build and enter a complete, valid knockout bracket. You may enter up to the number of brackets shown in the app.",
      "Each pick locks at its scheduled kickoff. Only complete, valid entries opted into the public challenge are eligible.",
    ],
  },
  {
    heading: "Prizes",
    body: [
      "Each challenge awards one gift-card prize (in U.S. dollars):",
      "• Match Day Pickem: a $50 gift card.",
      "• Knockout Challenge: a gift card that scales with participation — $1 for every eligible entrant, with a guaranteed minimum of $50 and a maximum of $250. The final amount is fixed by the number of eligible entrants when the challenge completes.",
      "Prizes are awarded as gift cards delivered electronically. Prizes are non-transferable and have no cash alternative. The Promoter may substitute a prize of equal or greater value if necessary.",
    ],
  },
  {
    heading: "How winners are determined",
    body: [
      "When a challenge completes, the single entry ranked first on that challenge’s public leaderboard wins, using the scoring and tie-break rules shown in the app. If two or more eligible entries are tied for first after tie-breaks, the Promoter will resolve the tie fairly (for example, by an additional tie-break or by dividing the prize) before awarding.",
      "Scoring is deterministic and based solely on official match results. The Promoter may correct results or standings to reflect the official outcome.",
    ],
  },
  {
    heading: "Notification & claim",
    body: [
      "The potential winner will be notified by email and/or in-app notification using the details on their account. The Promoter may require reasonable verification of identity, age, and eligibility before awarding a prize. If a winner cannot be contacted, declines, fails to respond within a reasonable time, or is found ineligible, the Promoter may select the next eligible entry or withhold the prize.",
    ],
  },
  {
    heading: "Taxes",
    body: [
      "You are responsible for any taxes that apply to a prize you receive. The Promoter may be required to collect tax information before awarding a prize where the law requires it.",
    ],
  },
  {
    heading: "General",
    body: [
      "Prizes are offered as a goodwill gesture and the Promoter may change, suspend, or withdraw a challenge or prize at any time, including for reasons outside its control. By entering you agree to these rules and to the Promoter’s decisions, which are final. These rules are governed by the laws of the State of New Jersey, United States.",
    ],
  },
];

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-[640px] px-5 pb-16 pt-12">
      <Link
        href="/"
        className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
      >
        ← Back
      </Link>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">Legal</p>
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">
          Official Prize Rules
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">Last updated {LAST_UPDATED}.</p>

        <div className="mt-5 space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-lg text-ink">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-6 text-[12px] text-ink-3">
          See also our{" "}
          <Link href="/terms" className="font-semibold text-pitch-dark hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-pitch-dark hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
