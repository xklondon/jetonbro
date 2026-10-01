import { expect, test } from "vitest";
import { resolveActorFromIdentities, type Actor } from "./actor-resolve";

const owner: Actor = {
  id: "owner-1",
  email: "alex@jetonbro.test",
  name: "Alex",
  isGuest: false,
  guestTableId: null,
};

const guest: Actor = {
  id: "guest-1",
  email: "guest.abc@guest.invalid",
  name: "Casey",
  isGuest: true,
  guestTableId: "table-1",
};

test("guest cookie wins over a verified session on the invited table", () => {
  expect(resolveActorFromIdentities({ tableId: "table-1", verified: owner, guest })).toEqual(guest);
});

test("guest cookie does not override a verified session on another table", () => {
  expect(resolveActorFromIdentities({ tableId: "table-2", verified: owner, guest })).toEqual(owner);
});

test("home and create-table prefer verified identity when both exist", () => {
  expect(resolveActorFromIdentities({ verified: owner, guest })).toEqual(owner);
});

test("guest-only identity is used when no verified session exists", () => {
  expect(resolveActorFromIdentities({ tableId: "table-1", verified: null, guest })).toEqual(guest);
});
