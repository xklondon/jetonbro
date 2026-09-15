export const PAYOUT_SWIPE_THRESHOLD_PX = 72;
export const PAYOUT_HORIZONTAL_LOCK_PX = 10;

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
