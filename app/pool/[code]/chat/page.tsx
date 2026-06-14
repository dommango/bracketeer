import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { listMessages } from "@/lib/pool/chat";
import { Chat } from "../Chat";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const access = await getPoolAccess(pool.id);
  const sessionUser = access?.user ?? (await getSessionUser());
  const isMember = Boolean(access);
  const messages = isMember ? await listMessages(pool.id, 50, sessionUser?.id ?? null) : [];

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Chat</h2>
      <div className="mt-2.5">
        {isMember && sessionUser ? (
          <Chat poolId={pool.id} currentUserId={sessionUser.id} initialMessages={messages} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
            {sessionUser
              ? "Your account isn’t linked to an entry in this pool yet. Sign in with the email your bracket was imported under to join the chat."
              : "Sign in to join the pool chat."}
          </p>
        )}
      </div>
    </section>
  );
}
