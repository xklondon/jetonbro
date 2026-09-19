import { expect, test } from "vitest";
import {
  adjacentBoxId,
  boxNavSwipeDirection,
  endBoxNavDrag,
  moveBoxNavDrag,
  startBoxNavDrag,
} from "./box-nav-gesture";

function pointer(partial: Partial<Parameters<typeof startBoxNavDrag>[0]> & { clientX: number; clientY: number }) {
  return {
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
    button: 0,
    ...partial,
  };
}

test("left swipe selects the next box and right swipe wraps back", () => {
  expect(adjacentBoxId(["a", "b"], "a", "next")).toBe("b");
  expect(adjacentBoxId(["a", "b"], "b", "next")).toBe("a");
  expect(adjacentBoxId(["a", "b"], "b", "prev")).toBe("a");
  expect(adjacentBoxId(["a", "b"], "a", "prev")).toBe("b");
  expect(boxNavSwipeDirection(-80, 4)).toBe("next");
  expect(boxNavSwipeDirection(80, -3)).toBe("prev");
});

test("a tap and a vertical move are not swipes", () => {
  const tapStart = startBoxNavDrag(pointer({ clientX: 200, clientY: 80 }), null)!;
  expect(endBoxNavDrag(tapStart, pointer({ clientX: 204, clientY: 81 })).direction).toBeNull();
  expect(endBoxNavDrag(tapStart, pointer({ clientX: 204, clientY: 81 })).ignoreClick).toBe(false);

  const vertical = startBoxNavDrag(pointer({ clientX: 200, clientY: 80 }), null)!;
  const moved = moveBoxNavDrag(vertical, pointer({ clientX: 206, clientY: 180 }));
  expect(moved.dragging).toBe(false);
  expect(endBoxNavDrag(moved, pointer({ clientX: 206, clientY: 180 })).direction).toBeNull();
});

test("touch and mouse pointer paths both lock horizontally", () => {
  const touch = startBoxNavDrag(pointer({ clientX: 180, clientY: 90, pointerType: "touch" }), null)!;
  const dragged = moveBoxNavDrag(touch, pointer({ clientX: 100, clientY: 92, pointerType: "touch" }));
  expect(dragged.dragging).toBe(true);
  expect(endBoxNavDrag(dragged, pointer({ clientX: 100, clientY: 92, pointerType: "touch" })).direction).toBe("next");

  const mouse = startBoxNavDrag(pointer({ clientX: 180, clientY: 90, pointerType: "mouse" }), null)!;
  const right = moveBoxNavDrag(mouse, pointer({ clientX: 260, clientY: 91, pointerType: "mouse" }));
  expect(endBoxNavDrag(right, pointer({ clientX: 260, clientY: 91, pointerType: "mouse" })).direction).toBe("prev");
  expect(startBoxNavDrag(pointer({ clientX: 180, clientY: 90, isPrimary: false }), null)).toBeNull();
  expect(startBoxNavDrag(pointer({ clientX: 180, clientY: 90 }), { pointerId: 2 })).toBeNull();
});
