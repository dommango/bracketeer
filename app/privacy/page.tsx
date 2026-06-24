import Link from "next/link";

export const dynamic = "force-dynamic";

// Plain-language Privacy Policy. Operator: Dom Mangonon (individual), contact
// dommango@gmail.com. Data + provider categories reflect the app's actual
// integrations (auth, sports/odds feeds, payments, push, GIFs, feedback routing,
// hosting). Not a substitute for legal review before a public launch.
const LAST_UPDATED = "June 2026";

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "The short version",
    body: [
      "Bracketeer is a free prediction game for the 2026 FIFA World Cup, operated by Dom Mangonon. We collect the minimum we need to run the games, show leaderboards, and let you compete with friends. We don’t sell your personal information. Questions: dommango@gmail.com.",
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "Account information: your email address and the display name you choose. You sign in with Google, Facebook, or an email magic link; we receive your email (and, for social sign-in, basic profile info) from those providers.",
      "Your gameplay: the picks and brackets you submit, the pools you create or join, and the chat messages you post. If you enter a prize challenge, we also record that you accepted the Terms, Privacy Policy, and Official Rules and confirmed you are 18 or older.",
      "Feedback you send: the text of your report, the page you were on, and any screenshots you choose to attach.",
      "Technical data: standard log and device information, plus the essential cookies needed to keep you signed in and operate the app securely.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run the games — score your picks, build leaderboards, and resolve brackets.",
      "To show your display name and standings to other members of games and pools you join, and your messages in those pools’ chat. Public challenge leaderboards display your chosen name (never your email) to anyone who views them.",
      "To send account and game-related messages you’ve enabled, such as result and reminder notifications, and to contact a prize winner.",
      "To process payments if you choose a premium pool.",
      "To diagnose bugs and improve the app, using feedback and aggregate usage.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "We don’t sell your personal information. We share it only with service providers that help us run Bracketeer, and only as needed to provide the service. Depending on the features in use, these include:",
      "• Sign-in: Google and Facebook (OAuth) and our email-link delivery provider.",
      "• Live data: API-Football (api-sports.io) for scores and fixtures, and The Odds API for betting odds.",
      "• Payments: Stripe, for premium pools (we don’t store your full card details).",
      "• Notifications: Apple Push Notification service, for app push.",
      "• Chat media: Giphy, when you add a GIF.",
      "• Feedback routing: Notion, where your feedback reports are mirrored for triage.",
      "• Hosting and infrastructure: our cloud hosting provider (Railway).",
      "We may also disclose information if required by law or to protect the service and its users.",
    ],
  },
  {
    heading: "Your choices and rights",
    body: [
      "You can update your display name and control your notification settings at any time. From your Account page you can download a copy of your data (“Export my data”) and permanently delete your account and associated data (“Delete my account”). You can also email dommango@gmail.com for help with any request.",
      "Depending on where you live, you may have additional rights over your personal data (for example, under GDPR or CCPA); we’ll honor those requests as required by law.",
    ],
  },
  {
    heading: "Data retention",
    body: [
      "We keep your information for as long as your account is active or as needed to run the games, and then delete or anonymize it. If you delete your account, we remove your personal data and the pools you own; some minimal records may be retained where required by law.",
    ],
  },
  {
    heading: "Children",
    body: [
      "Bracketeer is intended for people 13 and older and is not directed at children under 13; prize challenges are restricted to those 18 and older. If you are under 18, please use it with a parent or guardian’s involvement. If you believe a child under 13 has given us personal information, contact us and we’ll delete it.",
    ],
  },
  {
    heading: "Security & international use",
    body: [
      "We use reasonable measures to protect your information, but no method of storage or transmission is completely secure. Bracketeer is operated from the United States; if you use it from elsewhere, your information will be processed in the United States.",
    ],
  },
  {
    heading: "Changes & contact",
    body: [
      "We may update this policy; material changes will be noted here with an updated date. Questions or requests? Email dommango@gmail.com.",
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
