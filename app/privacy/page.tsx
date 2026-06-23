import Link from "next/link";

export const dynamic = "force-dynamic";

// Placeholder Privacy Policy. Describes, in plain terms, what we collect and why —
// the spirit of the request ("tell people what their info is used for"). Boilerplate
// only, not legal advice; bracketed items still need real values before launch.
const LAST_UPDATED = "June 2026";

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "The short version",
    body: [
      "Bracketeer is a free prediction game for the 2026 FIFA World Cup. We collect the minimum we need to run the games, show leaderboards, and let you compete with friends. We don’t sell your personal information.",
    ],
  },
  {
    heading: "What we collect",
    body: [
      "Account details: your email address and the display name you choose.",
      "Your gameplay: the picks and brackets you submit, and the pools you create or join.",
      "Feedback you send: the text, the page you were on, and any screenshots you choose to attach.",
      "Basic technical data: standard log/device information needed to operate and secure the app.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run the games — score your picks, build leaderboards, and resolve brackets.",
      "To show your display name and standings to other members of games and pools you join.",
      "To send game-related messages you’ve opted into (e.g. result and reminder notifications).",
      "To fix bugs and improve the app, using feedback and aggregate usage.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "We don’t sell your data. We share it only with service providers that help us run the app — for example sign-in, email delivery, push notifications, and hosting — and only as needed to provide the service. [Specific providers TBD.]",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can update your display name, control notifications, and request deletion of your account and associated data. To make a request, contact us at [contact email TBD].",
    ],
  },
  {
    heading: "Retention & changes",
    body: [
      "We keep your information for as long as your account is active or as needed to run the games, then delete or anonymize it. We may update this policy; material changes will be noted here.",
    ],
  },
];

export default function PrivacyPage() {
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
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">Privacy Policy</h1>
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
          <Link href="/terms" className="font-semibold text-pitch-dark hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
