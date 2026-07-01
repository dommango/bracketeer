import Link from "next/link";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { listChallengeMessages } from "@/lib/challenge/chat";
import { DISPLAY_TZ } from "@/lib/tz";

// Short time-of-day in the display zone (Eastern), matching the pool HomeChat so
// timestamps read identically across the app.
function chatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

// The latest few global-challenge-chat messages as a compact card on the challenge
// home boards, mirroring the pool Home's "Latest from chat" preview. Links to the
// full chat page. Renders nothing when the chat is empty.
export async function ChallengeRecentChat() {
  const tournamentId = await getTournamentIdBySlug();
  const messages = await listChallengeMessages(tournamentId, 5, null);

  const header = (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xs font-bold tracking-[0.02em] text-ink-3">Latest from the chat:</h2>
      <Link href="/challenge/chat" className="text-xs font-semibold text-pitch hover:underline">
        Open chat →
      </Link>
    </div>
  );

  // Always render so the home has a chat entry point, even before anyone's posted.
  if (messages.length === 0) {
    return (
      <section>
        {header}
        <Link
          href="/challenge/chat"
          className="mt-2.5 block rounded-2xl border border-dashed border-line bg-surface px-4 py-5 text-center text-sm text-ink-3 transition-colors hover:bg-surface-sunk"
        >
          No messages yet — be the first to say hello 👋
        </Link>
      </section>
    );
  }

  return (
    <section>
      {header}
      <ul className="mt-2.5 divide-y divide-line rounded-2xl border border-line bg-surface">
        {/* Newest first in this preview: the list arrives oldest→newest. */}
        {[...messages].reverse().map((m) => (
          <li key={m.id} className="flex items-baseline gap-2 px-4 py-2.5 text-sm">
            <span className="shrink-0 font-semibold text-ink">
              {m.kind === "SYSTEM" ? "Match update" : (m.authorName ?? "Player")}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink-2">
              {m.body?.trim()
                ? m.body
                : m.attachmentType === "GIF"
                  ? "Sent a GIF"
                  : m.attachmentType === "IMAGE"
                    ? "Sent a photo"
                    : ""}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-ink-4">{chatTime(m.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
