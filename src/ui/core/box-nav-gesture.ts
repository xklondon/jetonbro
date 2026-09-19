export const BOX_NAV_SWIPE_THRESHOLD_PX = 56;
export const BOX_NAV_HORIZONTAL_LOCK_PX = 10;

export type BoxNavDirection = "next" | "prev";

export type BoxNavPointerInput = {
  isPrimary: boolean;
  pointerId: number;
  pointerType?: string;
  button?: number;
  clientX: number;
  clientY: number;
};

export type BoxNavSession = {
  pointerId: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  dragging: boolean;
};

export function adjacentBoxId(
  ids: string[],
  currentId: string | null,
  direction: BoxNavDirection,
): string | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0] ?? null;
  const index = currentId ? ids.indexOf(currentId) : 0;
  const start = index < 0 ? 0 : index;
  const next = direction === "next" ? (start + 1) % ids.length : (start - 1 + ids.length) % ids.length;
  return ids[next] ?? currentId;
}

export function boxNavSwipeDirection(
  dx: number,
  dy: number,
  threshold = BOX_NAV_SWIPE_THRESHOLD_PX,
): BoxNavDirection | null {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? "next" : "prev";
}

export function isHorizontalBoxNavGesture(dx: number, dy: number, lock = BOX_NAV_HORIZONTAL_LOCK_PX): boolean {
  return Math.abs(dx) >= lock && Math.abs(dx) > Math.abs(dy);
}

export function startBoxNavDrag(
  pointer: BoxNavPointerInput,
  active: { pointerId: number } | null,
): BoxNavSession | null {
  if (!pointer.isPrimary) return null;
  if (pointer.button !== undefined && pointer.button !== 0) return null;
  if (active) return null;
  return {
    pointerId: pointer.pointerId,
    originX: pointer.clientX,
    originY: pointer.clientY,
    dx: 0,
    dy: 0,
    dragging: false,
  };
}

export function moveBoxNavDrag(session: BoxNavSession, pointer: BoxNavPointerInput): BoxNavSession {
  if (!pointer.isPrimary || pointer.pointerId !== session.pointerId) return session;
  const dx = pointer.clientX - session.originX;
  const dy = pointer.clientY - session.originY;
  if (session.dragging || isHorizontalBoxNavGesture(dx, dy)) {
    return { ...session, dragging: true, dx, dy };
  }
  return { ...session, dx, dy };
}

export function endBoxNavDrag(session: BoxNavSession, pointer: BoxNavPointerInput): {
  direction: BoxNavDirection | null;
  ignoreClick: boolean;
} {
  if (!pointer.isPrimary || pointer.pointerId !== session.pointerId) {
    return { direction: null, ignoreClick: false };
  }
  const dx = pointer.clientX - session.originX;
  const dy = pointer.clientY - session.originY;
  const direction = boxNavSwipeDirection(dx, dy);
  if (direction) return { direction, ignoreClick: true };
  return { direction: null, ignoreClick: false };
}
