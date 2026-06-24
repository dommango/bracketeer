// Prize-challenge consent: a user must accept the Terms / Privacy Policy /
// Official Rules and self-attest 18+ before entering a challenge that carries a
// prize. We record it once on the User (timestamps, not a bool, for an auditable
// trail) and treat its presence as "already consented" so repeat entries don't
// re-prompt.

import { prisma } from "@/lib/db";

// Whether the user has previously accepted the terms (so the UI can skip the
// consent checkbox on subsequent entries).
export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { termsAcceptedAt: true },
  });
  return Boolean(u?.termsAcceptedAt);
}

// Ensure consent before a prize-eligible entry. No-op (ok) if already recorded;
// otherwise this submission must carry explicit agreement, which we then stamp.
// Returns { ok: false } and writes nothing when agreement is missing. The stamp
// is a guarded updateMany (where termsAcceptedAt is null) so two concurrent first
// entries can't clobber the original consent instant — whoever writes first wins,
// the loser updates 0 rows and the existing timestamp stands.
export async function ensureChallengeConsent(
  userId: string,
  agreed: boolean,
): Promise<{ ok: boolean }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { termsAcceptedAt: true },
  });
  if (u?.termsAcceptedAt) return { ok: true };
  if (!agreed) return { ok: false };
  const now = new Date();
  await prisma.user.updateMany({
    where: { id: userId, termsAcceptedAt: null },
    data: { termsAcceptedAt: now, ageConfirmedAt: now },
  });
  return { ok: true };
}
