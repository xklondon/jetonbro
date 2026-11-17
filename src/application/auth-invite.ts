import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/application/db";
import { publicOrigin, rewriteMagicLinkUrl } from "@/application/auth-urls";
import { verifiedJoinPath } from "@/application/invite-urls";

const DEFAULT_MAX_AGE_SECONDS = 60 * 60;
/** Align invite magic links with EMAIL invitation lifetime (48h). */
export const INVITE_SIGN_IN_MAX_AGE_SECONDS = 48 * 60 * 60;

function hashAuthToken(token: string, secret: string): string {
  return createHash("sha256").update(`${token}${secret}`).digest("hex");
}

function randomAuthToken(): string {
  return Array.from(randomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Build an Auth.js email callback URL that signs in `email` and returns to
 * `/join/verified/{inviteToken}`. Does not consume the table invitation.
 */
export async function createInviteSignInUrl(input: {
  email: string;
  inviteToken: string;
  origin: string;
  maxAgeSeconds?: number;
}): Promise<string> {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required to send invitation sign-in links.");
  }
  const email = input.email.normalize("NFKC").toLowerCase().trim();
  if (!email || email.includes('"') || email.split("@").length !== 2) {
    throw new Error("Invalid email address format.");
  }
  const token = randomAuthToken();
  const maxAge = input.maxAgeSeconds ?? INVITE_SIGN_IN_MAX_AGE_SECONDS;
  const expires = new Date(Date.now() + maxAge * 1000);
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashAuthToken(token, secret),
      expires,
    },
  });
  const origin = publicOrigin(input.origin);
  const callbackUrl = verifiedJoinPath(input.inviteToken);
  const url = `${origin}/api/auth/callback/email?${new URLSearchParams({
    callbackUrl,
    token,
    email,
  })}`;
  return rewriteMagicLinkUrl(url);
}

/** Fallback when Auth sign-in URL cannot be minted — plain verified join path. */
export function inviteJoinFallbackUrl(origin: string, inviteToken: string): string {
  const base = publicOrigin(origin);
  return `${base}${verifiedJoinPath(inviteToken)}`;
}

/**
 * Preferred invitation email URL: Auth.js magic link with join callback.
 * Falls back to `/join/verified/{token}` if AUTH_SECRET / token mint fails.
 */
export async function invitationEmailUrl(origin: string, email: string, inviteToken: string): Promise<string> {
  try {
    return await createInviteSignInUrl({ email, inviteToken, origin });
  } catch {
    return inviteJoinFallbackUrl(origin, inviteToken);
  }
}
