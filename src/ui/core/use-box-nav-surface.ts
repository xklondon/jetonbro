"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  adjacentBoxId,
  endBoxNavDrag,
  moveBoxNavDrag,
  startBoxNavDrag,
  type BoxNavPointerInput,
  type BoxNavSession,
} from "./box-nav-gesture";

function fromPointer(event: PointerEvent): BoxNavPointerInput {
  return {
    isPrimary: event.isPrimary,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

function fromTouch(touch: Touch): BoxNavPointerInput {
  return {
    isPrimary: true,
    pointerId: touch.identifier,
    pointerType: "touch",
    button: 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
  };
}

export function useBoxNavSurface(
  enabled: boolean,
  boxIds: string[],
  selectedId: string | null,
  onSelect: (id: string) => void,
): {
  surfaceRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  ignoreClick: RefObject<boolean>;
} {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<BoxNavSession | null>(null);
  const ignoreClick = useRef(false);
  const touchActiveRef = useRef(false);
  const boxIdsRef = useRef(boxIds);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  boxIdsRef.current = boxIds;
  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !enabled) return;

    const start = (input: BoxNavPointerInput) => {
      const next = startBoxNavDrag(input, sessionRef.current);
      if (!next) return;
      sessionRef.current = next;
      ignoreClick.current = false;
    };

    const move = (input: BoxNavPointerInput, event: Event) => {
      if (!sessionRef.current) return;
      const wasDragging = sessionRef.current.dragging;
      const next = moveBoxNavDrag(sessionRef.current, input);
      sessionRef.current = next;
      if (!next.dragging) return;
      event.preventDefault();
      if (!wasDragging) setDragging(true);
    };

    const end = (input: BoxNavPointerInput) => {
      const current = sessionRef.current;
      sessionRef.current = null;
      setDragging(false);
      touchActiveRef.current = false;
      if (!current) return;
      const ended = endBoxNavDrag(current, input);
      if (ended.ignoreClick) ignoreClick.current = true;
      if (!ended.direction) return;
      const nextId = adjacentBoxId(boxIdsRef.current, selectedIdRef.current, ended.direction);
      if (nextId) onSelectRef.current(nextId);
    };

    const skipTrustedTouchPointer = (event: PointerEvent) =>
      event.pointerType === "touch" && event.isTrusted;

    const onPointerDown = (event: PointerEvent) => {
      if (skipTrustedTouchPointer(event) || touchActiveRef.current) return;
      start(fromPointer(event));
    };
    const onPointerMove = (event: PointerEvent) => {
      if (skipTrustedTouchPointer(event) || touchActiveRef.current) return;
      move(fromPointer(event), event);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (skipTrustedTouchPointer(event) || touchActiveRef.current) return;
      end(fromPointer(event));
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (skipTrustedTouchPointer(event) || touchActiveRef.current) return;
      end(fromPointer(event));
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      touchActiveRef.current = true;
      start(fromTouch(touch));
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      move(fromTouch(touch), event);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        sessionRef.current = null;
        setDragging(false);
        touchActiveRef.current = false;
        return;
      }
      end(fromTouch(touch));
    };

    const onClickCapture = (event: Event) => {
      if (!ignoreClick.current) return;
      ignoreClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    el.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    el.addEventListener("touchend", onTouchEnd, { capture: true });
    el.addEventListener("touchcancel", onTouchEnd, { capture: true });
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("touchstart", onTouchStart, true);
      el.removeEventListener("touchmove", onTouchMove, true);
      el.removeEventListener("touchend", onTouchEnd, true);
      el.removeEventListener("touchcancel", onTouchEnd, true);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled]);

  return { surfaceRef, dragging, ignoreClick };
}
