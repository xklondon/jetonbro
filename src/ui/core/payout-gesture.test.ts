import { expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { payoutSwipeOutcome, isHorizontalPayoutGesture } from "./payout-gesture";
import { selectOutcomeCelebration } from "./outcome-celebration";
import { OutcomeCelebrationOverlay } from "@/ui/skins/classic/components/OutcomeCelebration";

test("swipe right is WIN and swipe left is LOSS after the threshold", () => {
  expect(payoutSwipeOutcome(80, 4)).toBe("WON");
  expect(payoutSwipeOutcome(-80, 4)).toBe("LOST");
  expect(payoutSwipeOutcome(20, 2)).toBeNull();
  expect(payoutSwipeOutcome(80, 90)).toBeNull();
});

test("horizontal lock starts only after a clear sideways move", () => {
  expect(isHorizontalPayoutGesture(12, 2)).toBe(true);
  expect(isHorizontalPayoutGesture(4, 20)).toBe(false);
});

test("player celebrations overlay and reduced motion is testable", () => {
  const win = selectOutcomeCelebration("box-1:WON", "WON", false, "player", "50");
  const again = selectOutcomeCelebration("box-1:WON", "WON", false, "player", "50");
  expect(win).toEqual(again);
  expect(win.overlay).toBe(true);
  expect(win.copy).toMatch(/WINNER!|NICE ONE!/);
  expect(win.copy).toContain("50");
  const dealer = selectOutcomeCelebration("box-1:WON", "WON", false, "dealer", "50");
  expect(dealer.overlay).toBe(false);
  const quiet = selectOutcomeCelebration("box-1:WON", "WON", true, "player", "50");
  expect(quiet.overlay).toBe(false);
  const push = selectOutcomeCelebration("box-2:PUSH", "PUSH", false, "player");
  expect(push.copy).toContain("PUSH");
});

test("celebration overlay is decorative and hidden from assistive tech", () => {
  const html = renderToStaticMarkup(
    createElement(OutcomeCelebrationOverlay, {
      celebration: { kind: "rain", copy: "WINNER!", overlay: true },
    }),
  );
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("WINNER!");
  const quiet = renderToStaticMarkup(
    createElement(OutcomeCelebrationOverlay, {
      celebration: { kind: "row", copy: "WINNER!", overlay: false },
    }),
  );
  expect(quiet).toBe("");
});
