import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PremiumInviteMask } from "./PremiumInviteMask";

describe("PremiumInviteMask", () => {
  it("mounts only when open and exposes guest QR method", () => {
    const closed = renderToStaticMarkup(
      createElement(PremiumInviteMask, {
        open: false,
        onClose: () => undefined,
        guestJoinUrl: "https://example.test/join/guest",
        verifiedJoinUrl: "https://example.test/join/verified",
        onCommand: async () => true,
      }),
    );
    expect(closed).toBe("");

    const open = renderToStaticMarkup(
      createElement(PremiumInviteMask, {
        open: true,
        onClose: () => undefined,
        guestJoinUrl: "https://example.test/join/guest",
        verifiedJoinUrl: "https://example.test/join/verified",
        onCommand: async () => true,
      }),
    );
    expect(open).toContain('data-invite-mask="true"');
    expect(open).toContain('data-invite-kind="guest"');
    expect(open).toContain("GUEST QR");
    expect(open).toContain("VERIFIED QR");
    expect(open).toContain("EMAIL");
  });
});
