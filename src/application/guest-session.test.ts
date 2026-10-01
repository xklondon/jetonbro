import { expect, test } from "vitest";
import { signGuestToken, verifyGuestToken } from "@/application/guest-session";
import { guestJoinPath, verifiedJoinPath, inviteIntentFromPath } from "@/application/invite-urls";

test("guest and verified invite paths encode different intents", () => {
  expect(guestJoinPath("abc")).toBe("/join/guest/abc");
  expect(verifiedJoinPath("abc")).toBe("/join/verified/abc");
  expect(guestJoinPath("abc")).not.toBe(verifiedJoinPath("abc"));
  expect(inviteIntentFromPath("/join/guest/abc")).toBe("guest");
  expect(inviteIntentFromPath("/join/verified/abc")).toBe("verified");
});

test("guest session tokens are table-scoped and signed", () => {
  const token = signGuestToken("user-1", "table-1", 1_000);
  expect(verifyGuestToken(token, 500)).toEqual({ userId: "user-1", tableId: "table-1" });
  expect(verifyGuestToken(token, 1_000 + 14 * 24 * 60 * 60 * 1000 + 1)).toBeNull();
  expect(verifyGuestToken("tampered." + token, 500)).toBeNull();
});
