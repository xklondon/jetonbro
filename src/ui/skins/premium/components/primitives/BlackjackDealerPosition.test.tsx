import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlackjackDealerPosition } from "./BlackjackDealerPosition";

describe("Premium Blackjack dealer label", () => {
  it("renders text-only DEALER · name without chip medal", () => {
    const html = renderToStaticMarkup(createElement(BlackjackDealerPosition, { name: "Dee" }));
    expect(html).toContain("DEALER · Dee");
    expect(html).toContain('data-dealer-label="true"');
    expect(html).not.toContain("pm-bj-dealer-medal");
    const source = readFileSync(join(__dirname, "BlackjackDealerPosition.tsx"), "utf8");
    expect(source).not.toMatch(/pm-bj-dealer-medal|border-radius: 999px/);
  });
});
