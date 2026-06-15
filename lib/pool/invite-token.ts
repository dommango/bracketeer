// Pure helpers for pool invites: token generation, validity, and link building.
// Kept free of prisma/env so they're unit-testable; the DB-touching create/accept
// flow lives in invites.ts.

import { randomBytes } from "node:crypto";

// 24 bytes → 32 url-safe base64 chars: enough entropy to be unguessable, short
// enough to live in a link. base64url avoids +/ = so the token is path-safe.
export const INVITE_TOKEN_BYTES = 24;

export function generateInviteToken(bytes: number = INVITE_TOKEN_BYTES): string {
  return randomBytes(bytes).toString("base64url");
}

export interface InviteValidity {
  acceptedAt: Date | null;
  expiresAt: Date | null;
}

// An invite is usable until it's accepted (single-use) or its expiry passes. A
// null expiry never time-expires.
export function isInviteValid(invite: InviteValidity, now: Date = new Date()): boolean {
  if (invite.acceptedAt) return false;
  if (invite.expiresAt && now.getTime() >= invite.expiresAt.getTime()) return false;
  return true;
}

export function inviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/invite/${token}`;
}
