import { expect, test } from "vitest";
import { assertInvitationUsable } from "./types";

test("expired and used invitation links are rejected", () => {
  const base = {
    kind: "EMAIL" as const,
    email: "alex@example.com",
    expiresAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    usedAt: null,
  };
  expect(() =>
    assertInvitationUsable(base, new Date("2026-01-02T00:00:00Z")),
  ).toThrow(/expired/i);
  expect(() =>
    assertInvitationUsable({ ...base, expiresAt: new Date("2026-02-01"), usedAt: new Date() }, new Date("2026-01-15")),
  ).toThrow(/already been used/i);
  expect(() =>
    assertInvitationUsable({ ...base, expiresAt: new Date("2026-02-01") }, new Date("2026-01-15"), "other@example.com"),
  ).toThrow(/different email/i);
});

test("QR invitations stay usable until revoked or expired", () => {
  expect(() =>
    assertInvitationUsable(
      {
        kind: "QR",
        email: null,
        expiresAt: new Date("2026-02-01"),
        revokedAt: null,
        usedAt: new Date(),
      },
      new Date("2026-01-15"),
    ),
  ).not.toThrow();
});
