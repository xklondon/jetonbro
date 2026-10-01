import { auth } from "@/application/auth";
import { prisma } from "@/application/db";
import { readGuestCookie } from "@/application/guest-session";
import { ForbiddenError } from "@/domain/errors";

export type Actor = {
  id: string;
  email: string;
  name: string | null;
  isGuest: boolean;
  guestTableId: string | null;
};

export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user && !user.isGuest) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        isGuest: false,
        guestTableId: null,
      };
    }
  }
  const guest = await readGuestCookie();
  if (!guest) return null;
  const user = await prisma.user.findUnique({ where: { id: guest.userId } });
  if (!user?.isGuest || user.guestTableId !== guest.tableId) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isGuest: true,
    guestTableId: user.guestTableId,
  };
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
