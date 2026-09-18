export const PAYOUT_SWIPE_THRESHOLD_PX = 72;
export const PAYOUT_HORIZONTAL_LOCK_PX = 10;
export const PAYOUT_DOUBLE_TAP_MS = 400;
export const PAYOUT_DRAG_CLAMP_PX = 120;

export type PayoutPointerInput = {
  isPrimary: boolean;
  pointerId: number;
  pointerType?: string;
  button?: number;
  clientX: number;
  clientY: number;
  fromAction?: boolean;
};

export type PayoutDragSession = {
  pointerId: number;
  originX: number;
  originY: number;
  dx: number;
  dragging: boolean;
};

export type PayoutDragEnd = {
  outcome: "WON" | "LOST" | "PUSH" | null;
  ignoreClick: boolean;
  lastTap: number;
};

export function payoutSwipeOutcome(
  dx: number,
  dy: number,
  threshold = PAYOUT_SWIPE_THRESHOLD_PX,
): "WON" | "LOST" | null {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx > 0 ? "WON" : "LOST";
}

export function isHorizontalPayoutGesture(dx: number, dy: number, lock = PAYOUT_HORIZONTAL_LOCK_PX): boolean {
  return Math.abs(dx) >= lock && Math.abs(dx) > Math.abs(dy);
}

export function startPayoutDrag(
  pointer: PayoutPointerInput,
  active: { pointerId: number } | null,
): PayoutDragSession | null {
  if (!pointer.isPrimary) return null;
  if (pointer.button !== undefined && pointer.button !== 0) return null;
  if (pointer.fromAction) return null;
  if (active) return null;
  return {
    pointerId: pointer.pointerId,
    originX: pointer.clientX,
    originY: pointer.clientY,
    dx: 0,
    dragging: false,
  };
}

export function movePayoutDrag(session: PayoutDragSession, pointer: PayoutPointerInput): PayoutDragSession {
  if (!pointer.isPrimary || pointer.pointerId !== session.pointerId) return session;
  const dx = pointer.clientX - session.originX;
  const dy = pointer.clientY - session.originY;
  if (session.dragging || isHorizontalPayoutGesture(dx, dy)) {
    return {
      ...session,
      dragging: true,
      dx: Math.max(-PAYOUT_DRAG_CLAMP_PX, Math.min(PAYOUT_DRAG_CLAMP_PX, dx)),
    };
  }
  return session;
}

export function endPayoutDrag(
  session: PayoutDragSession,
  pointer: PayoutPointerInput,
  now: number,
  lastTap: number,
): PayoutDragEnd {
  if (!pointer.isPrimary || pointer.pointerId !== session.pointerId) {
    return { outcome: null, ignoreClick: false, lastTap };
  }
  const dx = pointer.clientX - session.originX;
  const dy = pointer.clientY - session.originY;
  const swipe = payoutSwipeOutcome(dx, dy);
  if (swipe) {
    return { outcome: swipe, ignoreClick: true, lastTap: 0 };
  }
  if (session.dragging || Math.abs(dx) >= PAYOUT_HORIZONTAL_LOCK_PX) {
    return { outcome: null, ignoreClick: false, lastTap: 0 };
  }
  if (now - lastTap < PAYOUT_DOUBLE_TAP_MS) {
    return { outcome: "PUSH", ignoreClick: true, lastTap: 0 };
  }
  return { outcome: null, ignoreClick: false, lastTap: now };
}
