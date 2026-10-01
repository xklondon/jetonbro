export type Actor = {
  id: string;
  email: string;
  name: string | null;
  isGuest: boolean;
  guestTableId: string | null;
};

export function resolveActorFromIdentities(input: {
  tableId?: string | null;
  verified: Actor | null;
  guest: Actor | null;
}): Actor | null {
  const tableId = input.tableId ?? null;
  if (tableId && input.guest?.isGuest && input.guest.guestTableId === tableId) {
    return input.guest;
  }
  if (input.verified && !input.verified.isGuest) {
    return input.verified;
  }
  return input.guest;
}
