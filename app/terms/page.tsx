import Link from "next/link";

export const dynamic = "force-dynamic";

// Placeholder Terms of Service. Boilerplate only — the wording is a starting point,
// not legal advice, and the bracketed items still need real values before launch.
const LAST_UPDATED = "June 2026";

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. Who we are",
    body: [
      "Bracketeer (“we”, “us”) is a free-to-play prediction game for the 2026 FIFA World Cup, operated by Dom Mangonon. By using the app you agree to these terms.",
    ],
  },
  {
    heading: "2. Eligibility & accounts",
    body: [
      "You need an account to play. You’re responsible for keeping your sign-in secure and for everything done under your account. Provide accurate information when you sign up.",
    ],
  },
  {
    heading: "3. The games",
    body: [
      "Bracketeer offers prediction games (e.g. Match Day Pickem and the Knockout Challenge) and private pools you can create or join. Picks lock at the times shown in the app, and scoring follows the rules described on each game’s page. We may correct results or scores if a data provider is wrong.",
    ],
  },
  {
    heading: "4. Prizes",
    body: [
      "Some public challenges may offer a prize. Any prize, its value, and how a winner is determined are described where the challenge is promoted. Prizes are a goodwill offering and may change or be withdrawn. [Prize terms TBD.]",
    ],
  },
  {
    heading: "5. Acceptable use",
    body: [
      "Don’t abuse the service: no cheating, scraping, attempting to disrupt the app, or impersonating others. We may suspend accounts that break these terms.",
    ],
  },
  {
    heading: "6. No affiliation",
    body: [
      "Bracketeer is an independent fan project. It is not affiliated with, endorsed by, or sponsored by FIFA or any team. Team names and tournament data are used for identification only.",
    ],
  },
  {
    heading: "7. Disclaimer & liability",
    body: [
      "The app is provided “as is”, without warranties. To the extent permitted by law, we’re not liable for losses arising from your use of the app. [Governing law / jurisdiction TBD.]",
    ],
  },
  {
    heading: "8. Changes & contact",
    body: [
      "We may update these terms; material changes will be noted here. Questions? Contact us at [contact email TBD].",
    ],
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

        <p className="mt-4 rounded-2xl border border-gold/40 bg-gold-tint px-4 py-3 text-[12px] font-semibold text-gold-dark">
          Draft — placeholder wording, not legal advice. Bracketed items still need
          finalizing before launch.
        </p>

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
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
