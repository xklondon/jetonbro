import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlackjackBox, chipBreakdown } from "./BlackjackBox";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

describe("Premium BlackjackBox chip breakdown", () => {
  it("breaks MAIN into factual denominations", () => {
    expect(chipBreakdown("30")).toEqual([25, 5]);
    expect(chipBreakdown("100")).toEqual([100]);
    expect(chipBreakdown("75")).toEqual([50, 25]);
    expect(chipBreakdown("0")).toEqual([]);
  });

  it("renders stack total equal to MAIN", () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackBox, {
        box: {
          id: "b1",
          playerId: "p1",
          playerName: "Casey",
          label: "Box 1",
          boxNumber: 1,
          bet: money("30"),
          originalStake: money("30"),
          isDoubled: false,
          isSplit: false,
          insurance: money("0"),
          insuranceMax: money("15"),
          insuranceResult: null,
          outcome: null,
          returned: null,
          payoutActions: [],
        },
      }),
    );
    expect(html).toContain('data-main-amount="30"');
    expect(html).toContain('data-chip-stack-total="30"');
    expect(html).toContain('data-chip-values="25+5"');
    expect(html).toContain('data-casino-jeton="true"');
    expect(html).toContain('data-chip-value="25"');
    expect(html).toContain('data-chip-value="5"');
    expect(html).not.toContain("pm-bj-disk");
  });

  it("exposes a per-jeton retract control without nesting a button in a button", () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackBox, {
        box: {
          id: "b1",
          playerId: "p1",
          playerName: "Casey",
          label: "Box 1",
          boxNumber: 1,
          bet: money("25"),
          originalStake: money("25"),
          isDoubled: false,
          isSplit: false,
          insurance: money("0"),
          insuranceMax: money("0"),
          insuranceResult: null,
          outcome: null,
          returned: null,
          payoutActions: [],
        },
        onSelect: () => undefined,
        onRetractChip: () => undefined,
      }),
    );
    expect(html).toContain('role="button"');
    expect(html).not.toMatch(/<button[^>]*role="button"/);
    expect(html).toContain('data-retract-chip="25"');
    expect(html).toContain("Retract 25 jetons");
    expect(html).toContain("pm-jeton-retract");
  });
});
