import { expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { payoutSwipeOutcome, isHorizontalPayoutGesture, startPayoutDrag, movePayoutDrag, endPayoutDrag } from "./payout-gesture";
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

function pointer(partial: Partial<Parameters<typeof startPayoutDrag>[0]> & { clientX: number; clientY: number }) {
  return {
    isPrimary: true,
    pointerId: 1,
    button: 0,
    fromAction: false,
    ...partial,
  };
}

test("full-row pointer capture path settles left as LOST and right as WON", () => {
  const start = startPayoutDrag(pointer({ clientX: 200, clientY: 80 }), null);
  expect(start).not.toBeNull();
  const left = movePayoutDrag(start!, pointer({ clientX: 110, clientY: 82 }));
  expect(left.dragging).toBe(true);
  expect(left.dx).toBeLessThan(0);
  expect(endPayoutDrag(left, pointer({ clientX: 110, clientY: 82 }), 1_000, 0).outcome).toBe("LOST");

  const rightStart = startPayoutDrag(pointer({ clientX: 200, clientY: 80 }), null)!;
  const right = movePayoutDrag(rightStart, pointer({ clientX: 290, clientY: 81 }));
  expect(endPayoutDrag(right, pointer({ clientX: 290, clientY: 81 }), 1_000, 0).outcome).toBe("WON");
});

test("below-threshold drag snaps back without settling", () => {
  const start = startPayoutDrag(pointer({ clientX: 200, clientY: 80 }), null)!;
  const moved = movePayoutDrag(start, pointer({ clientX: 230, clientY: 81 }));
  const ended = endPayoutDrag(moved, pointer({ clientX: 230, clientY: 81 }), 1_000, 0);
  expect(ended.outcome).toBeNull();
  expect(ended.lastTap).toBe(0);
});

test("a gesture that starts on a result button never begins", () => {
  expect(startPayoutDrag(pointer({ clientX: 200, clientY: 80, fromAction: true }), null)).toBeNull();
  expect(startPayoutDrag(pointer({ clientX: 200, clientY: 80, isPrimary: false }), null)).toBeNull();
  const first = startPayoutDrag(pointer({ clientX: 200, clientY: 80 }), null);
  expect(startPayoutDrag(pointer({ clientX: 210, clientY: 80, pointerId: 2 }), first)).toBeNull();
});

test("double tap on the row settles STAND OFF once", () => {
  const first = startPayoutDrag(pointer({ clientX: 200, clientY: 80 }), null)!;
  const tap = endPayoutDrag(first, pointer({ clientX: 201, clientY: 80 }), 1_000, 0);
  expect(tap.outcome).toBeNull();
  const second = startPayoutDrag(pointer({ clientX: 200, clientY: 80 }), null)!;
  const dbl = endPayoutDrag(second, pointer({ clientX: 201, clientY: 80 }), 1_250, tap.lastTap);
  expect(dbl.outcome).toBe("PUSH");
  expect(dbl.ignoreClick).toBe(true);
});

test("player celebrations overlay and reduced motion is testable", () => {
  const blackjack = selectOutcomeCelebration("box-1:BLACKJACK", "BLACKJACK", false, "player", "62.5");
  expect(blackjack.overlay).toBe(true);
  expect(blackjack.kind).toBe("shimmer");
  const dealer = selectOutcomeCelebration("box-1:BLACKJACK", "BLACKJACK", false, "dealer", "62.5");
  expect(dealer.overlay).toBe(false);
  const quiet = selectOutcomeCelebration("box-1:WON", "WON", true, "player", "50");
  expect(quiet.overlay).toBe(false);
  const push = selectOutcomeCelebration("box-2:PUSH", "PUSH", false, "player");
  expect(push.copy).toContain("PUSH");
  let strongWin: ReturnType<typeof selectOutcomeCelebration> | null = null;
  let rowWin: ReturnType<typeof selectOutcomeCelebration> | null = null;
  for (let index = 0; index < 40 && (!strongWin || !rowWin); index += 1) {
    const next = selectOutcomeCelebration(`win-seed-${index}:WON`, "WON", false, "player", "50");
    if (next.overlay) strongWin = next;
    else rowWin = next;
  }
  expect(strongWin?.overlay).toBe(true);
  expect(strongWin?.kind).toBe("rain");
  expect(rowWin?.overlay).toBe(false);
  expect(rowWin?.kind).toBe("row");
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
