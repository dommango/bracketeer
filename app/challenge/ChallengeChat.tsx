import { getSessionUser } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { listChallengeMessages, canPostChallengeChat } from "@/lib/challenge/chat";
import { giphyEnabled } from "@/lib/env";
import { Chat } from "@/app/pool/[code]/Chat";

const LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// The global challenge chat surface — one shared thread for everyone entered in an
// active public challenge. Public read; posting gated to entered players. Reuses the
// pool Chat client (poll-only, no pool SSE), embedded on the dedicated chat page and
// under a live challenge match.
export async function ChallengeChat({
  heading = "Challenge chat",
  limit = 50,
}: {
  heading?: string;
  limit?: number;
}) {
  const tournamentId = await getTournamentIdBySlug();
  const user = await getSessionUser();
  const [messages, canPost] = await Promise.all([
    listChallengeMessages(tournamentId, limit, user?.id ?? null),
    user ? canPostChallengeChat(user.id, tournamentId) : Promise.resolve(false),
  ]);
  const composerHint = user
    ? "Enter a challenge to join the chat."
    : "Sign in and enter a challenge to chat.";

  return (
    <section className="space-y-2">
      <h2 className={LABEL}>{heading}</h2>
      <Chat
        apiBase="/api/challenge"
        currentUserId={user?.id ?? null}
        initialMessages={messages}
        giphyEnabled={giphyEnabled}
        canPost={canPost}
        composerHint={composerHint}
        placeholder="Message the challenge…"
        pollMs={15000}
      />
    </section>
  );
}
