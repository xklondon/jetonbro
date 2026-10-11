import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PremiumPokerDealer setup wiring", () => {
  it("opens invite mask and uses canonical start/invite commands", () => {
    const source = readFileSync(join(__dirname, "PremiumPokerDealer.tsx"), "utf8");
    expect(source).toContain("PremiumInviteMask");
    expect(source).toContain("setInviteOpen(true)");
    expect(source).not.toContain("onClick: () => undefined");
    expect(source).toContain('onCommand("startTexasHoldem")');
    expect(source).toContain('onCommand("startNextPokerHand")');
    expect(source).toContain('onCommand("advancePokerStreet")');
    expect(source).toContain('variant={setup ? "setup" : "default"}');
    expect(source).toContain("ownerSeated");
  });
});
