import { auth } from "@/application/auth";
import { prisma } from "@/application/db";
import { guestCookieFromHeader, readGuestCookie } from "@/application/guest-session";
import { ForbiddenError } from "@/domain/errors";
import { resolveActorFromIdentities, type Actor } from "@/application/actor-resolve";

export type { Actor };
export { resolveActorFromIdentities };

async function loadGuestActor(cookieHeader?: string | null): Promise<Actor | null> {
  const cookie = guestCookieFromHeader(cookieHeader) ?? (await readGuestCookie());
  if (!cookie) return null;
  const user = await prisma.user.findUnique({ where: { id: cookie.userId } });
  if (!user?.isGuest || user.guestTableId !== cookie.tableId) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isGuest: true,
    guestTableId: user.guestTableId,
  };
}

export async function getActor(scope?: { tableId?: string | null; cookieHeader?: string | null }): Promise<Actor | null> {
  const session = await auth();
  let verified: Actor | null = null;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user && !user.isGuest) {
      verified = {
        id: user.id,
        email: user.email,
        name: user.name,
        isGuest: false,
        guestTableId: null,
      };
    }
  }
  const guest = await loadGuestActor(scope?.cookieHeader);
  return resolveActorFromIdentities({ tableId: scope?.tableId, verified, guest });
}

export function assertVerifiedActor(actor: Actor | null): Actor {
  if (!actor) {
    throw Object.assign(new Error("Sign in required."), { name: "Unauthorized" });
  }
  if (actor.isGuest) {
    throw new ForbiddenError("Guest access is limited to this table.");
  }
  return actor;
}

export function assertActorCanAccessTable(actor: Actor, tableId: string) {
  if (actor.isGuest && actor.guestTableId !== tableId) {
    throw new ForbiddenError("Guest access is limited to this table.");
  }
}
