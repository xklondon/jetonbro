export const INVITE_INTENTS = ["guest", "verified"] as const;
export type InviteIntent = (typeof INVITE_INTENTS)[number];

export function guestJoinPath(token: string): string {
  return `/join/guest/${token}`;
}

export function verifiedJoinPath(token: string): string {
  return `/join/verified/${token}`;
}

export function guestJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${guestJoinPath(token)}`;
}

export function verifiedJoinUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${verifiedJoinPath(token)}`;
}

export function inviteIntentFromPath(pathname: string): InviteIntent | null {
  if (pathname.startsWith("/join/guest/")) return "guest";
  if (pathname.startsWith("/join/verified/")) return "verified";
  return null;
}
