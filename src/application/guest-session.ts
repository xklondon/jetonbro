import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const GUEST_COOKIE = "jetonbro.guest";
const GUEST_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "jetonbro-dev-guest-secret";
}

export function signGuestToken(userId: string, tableId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: tableId, e: now + GUEST_TTL_MS })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyGuestToken(token: string, now = Date.now()): { userId: string; tableId: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: string; t?: string; e?: number };
    if (!data.u || !data.t || typeof data.e !== "number" || data.e <= now) return null;
    return { userId: data.u, tableId: data.t };
  } catch {
    return null;
  }
}

export function guestCookieOptions(production = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    path: "/",
    maxAge: Math.floor(GUEST_TTL_MS / 1000),
  };
}

export function cookieValueFromHeader(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export function guestCookieFromHeader(header: string | null | undefined): { userId: string; tableId: string } | null {
  const value = cookieValueFromHeader(header, GUEST_COOKIE);
  if (!value) return null;
  return verifyGuestToken(value);
}

export async function readGuestCookie(): Promise<{ userId: string; tableId: string } | null> {
  try {
    const store = await cookies();
    const value = store.get(GUEST_COOKIE)?.value;
    if (!value) return null;
    return verifyGuestToken(value);
  } catch {
    return null;
  }
}

export async function writeGuestCookie(userId: string, tableId: string) {
  const store = await cookies();
  store.set(GUEST_COOKIE, signGuestToken(userId, tableId), guestCookieOptions());
}
