import { ChallengeChat } from "@/app/challenge/ChallengeChat";

// Messages + live results change at request time.
export const dynamic = "force-dynamic";

// The dedicated global challenge chat page — one shared thread for everyone in an
// active public challenge. Reached from the "Open chat →" link on the challenge
// boards and under live matches.
export default function ChallengeChatPage() {
  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl text-ink">Challenge chat</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          One thread for everyone in an active challenge. Enter a challenge to join in.
        </p>
      </header>
      <ChallengeChat heading="Messages" limit={50} />
    </div>
  );
}
