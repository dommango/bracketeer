import Link from "next/link";

export const dynamic = "force-dynamic";

// Plain-language Terms of Service. Operator: Dom Mangonon (individual). Governing
// law: United States (New Jersey). Not a substitute for legal review before a
// public launch (prizes + public data collection carry real exposure).
const LAST_UPDATED = "June 2026";

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. About these terms",
    body: [
      "Bracketeer (“Bracketeer”, “we”, “us”) is a free-to-play prediction game for the 2026 FIFA World Cup, operated by Dom Mangonon. These Terms of Service govern your use of the app. By using Bracketeer you agree to them; if you don’t agree, please don’t use the app.",
    ],
  },
  {
    heading: "2. Who can use Bracketeer",
    body: [
      "You must be at least 13 years old to use Bracketeer. If you are under 18, you may use it only with the involvement and consent of a parent or guardian. You are responsible for everything that happens under your account.",
      "Prize challenges have a higher bar: you must be 18 or older to enter a challenge that offers a prize. See the Official Rules for full eligibility.",
    ],
  },
  {
    heading: "3. Your account",
    body: [
      "You sign in with Google, Facebook, or an email magic link. Keep your sign-in method secure — you’re responsible for activity on your account. Provide accurate information, and let us know if you believe your account has been used without permission.",
    ],
  },
  {
    heading: "4. The games",
    body: [
      "Bracketeer offers prediction games — including Match Day Pickem and the Knockout Challenge — and private pools you can create or join with friends using a join code. Picks lock at the times shown in the app, and scoring follows the rules described on each game’s page.",
      "Results and live scores come from third-party data providers and may be delayed or occasionally wrong. We may correct results, scores, or standings to reflect the official outcome, which can change points.",
    ],
  },
  {
    heading: "5. Prizes",
    body: [
      "Some public challenges offer a prize, such as a gift card. Bracketeer is free to play — no purchase is necessary to enter or win, and a purchase will not improve your chances. Entry to a prize challenge is open to eligible participants 18 and older where permitted by law, and is void where prohibited.",
      "The prize, its value, how a winner is determined, and full eligibility are set out in the Official Rules linked below. Prizes are offered as a goodwill gesture and may change or be withdrawn. You are responsible for any taxes on a prize you receive, and we may require reasonable verification before awarding a prize.",
    ],
  },
  {
    heading: "6. Acceptable use",
    body: [
      "Don’t misuse the service. In particular: no cheating or manipulating results, no creating multiple or duplicate accounts to gain an advantage in a prize challenge, no automated scraping or bots, no attempts to disrupt or gain unauthorized access to the app, no impersonating others, and no unlawful, abusive, or infringing activity. We may suspend or terminate accounts that break these terms.",
    ],
  },
  {
    heading: "7. Your content",
    body: [
      "You keep ownership of what you submit — your picks, display name, and chat messages. You grant us a non-exclusive license to store and display that content within the service (for example, your display name and standings on a leaderboard, or your messages in a pool’s chat). You’re responsible for what you post, and you agree not to post unlawful, harassing, or infringing content.",
    ],
  },
  {
    heading: "8. Not affiliated with FIFA",
    body: [
      "Bracketeer is an independent fan project. It is not affiliated with, endorsed by, or sponsored by FIFA, any football association, any team, or any platform (including Apple or Google). Tournament names, team names, and related data are used for identification and commentary only, and remain the property of their respective owners.",
    ],
  },
  {
    heading: "9. Third-party services",
    body: [
      "Bracketeer relies on third-party services — including sign-in providers, live sports-data and odds providers, payment processing, push notifications, and hosting. Your use of those services through Bracketeer may also be subject to their own terms. See our Privacy Policy for the categories of providers we use.",
    ],
  },
  {
    heading: "10. Disclaimers",
    body: [
      "Bracketeer is provided “as is” and “as available”, without warranties of any kind. We don’t guarantee that the app will be uninterrupted, error-free, or that scores, standings, or projections are accurate or current.",
    ],
  },
  {
    heading: "11. Limitation of liability",
    body: [
      "To the fullest extent permitted by law, Bracketeer and its operator will not be liable for any indirect, incidental, or consequential damages, or for any loss arising from your use of (or inability to use) the app.",
    ],
  },
  {
    heading: "12. Changes",
    body: [
      "We may update the app or these terms from time to time. Material changes will be noted here with an updated date. Continuing to use Bracketeer after a change means you accept the updated terms.",
    ],
  },
  {
    heading: "13. Governing law",
    body: [
      "These terms are governed by the laws of the State of New Jersey, United States, without regard to conflict-of-law rules. Any disputes will be handled in the state or federal courts located in New Jersey.",
    ],
  },
  {
    heading: "14. Contact",
    body: ["Questions about these terms? Email us at dommango@gmail.com."],
  },
];

export default function TermsPage() {
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
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">Terms of Service</h1>
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
          <Link href="/privacy" className="font-semibold text-pitch-dark hover:underline">
            Privacy Policy
          </Link>{" "}
          and the{" "}
          <Link href="/rules" className="font-semibold text-pitch-dark hover:underline">
            Official Prize Rules
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
