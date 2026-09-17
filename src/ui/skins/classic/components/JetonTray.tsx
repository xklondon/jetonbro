"use client";

import { useRef, useState } from "react";

const DENOMS = ["5", "10", "25", "50"] as const;

export function JetonTray({
  enabled,
  dropSelector,
  onTap,
  onDrop,
  onHover,
}: {
  enabled: boolean;
  dropSelector: string;
  onTap: (amount: string) => void;
  onDrop: (amount: string, targetId: string) => void;
  onHover?: (targetId: string | null) => void;
}) {
  const [drag, setDrag] = useState<{ denom: string; x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const activeDenom = useRef<string | null>(null);
  const onTapRef = useRef(onTap);
  const onDropRef = useRef(onDrop);
  const onHoverRef = useRef(onHover);
  onTapRef.current = onTap;
  onDropRef.current = onDrop;
  onHoverRef.current = onHover;
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function targetAtPoint(x: number, y: number): string | null {
    const stack =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(x, y)
        : [document.elementFromPoint(x, y)];
    for (const node of stack) {
      if (!node) continue;
      const hit = node.closest(dropSelector) as HTMLElement | null;
      if (!hit) continue;
      return hit.getAttribute("data-drop-box") ?? hit.getAttribute("data-drop-pot");
    }
    return null;
  }

  function trackMove(x: number, y: number, denom: string) {
    if (activeDenom.current !== denom || !origin.current) return;
    if (Math.hypot(x - origin.current.x, y - origin.current.y) > 8) skipClick.current = true;
    setDrag({ denom, x, y });
    onHoverRef.current?.(targetAtPoint(x, y));
  }

  function finish(x: number, y: number) {
    const denom = activeDenom.current;
    const dragged = skipClick.current;
    const target = targetAtPoint(x, y);
    activeDenom.current = null;
    origin.current = null;
    setDrag(null);
    onHoverRef.current?.(null);
    if (denom && dragged && target) onDropRef.current(denom, target);
  }

  function begin(denom: string, x: number, y: number) {
    if (!enabled || activeDenom.current) return false;
    skipClick.current = false;
    origin.current = { x, y };
    activeDenom.current = denom;
    setDrag({ denom, x, y });
    return true;
  }

  function bindWindow(kind: "pointer" | "mouse", denom: string) {
    const move = (event: PointerEvent | MouseEvent) => {
      trackMove(event.clientX, event.clientY, denom);
    };
    const up = (event: PointerEvent | MouseEvent) => {
      window.removeEventListener(kind === "pointer" ? "pointermove" : "mousemove", move);
      window.removeEventListener(kind === "pointer" ? "pointerup" : "mouseup", up);
      if (kind === "pointer") window.removeEventListener("pointercancel", up);
      finish(event.clientX, event.clientY);
    };
    window.addEventListener(kind === "pointer" ? "pointermove" : "mousemove", move);
    window.addEventListener(kind === "pointer" ? "pointerup" : "mouseup", up);
    if (kind === "pointer") window.addEventListener("pointercancel", up);
  }

  return (
    <>
      <div className="jetons">
        {DENOMS.map((denom) => (
          <button
            key={denom}
            type="button"
            disabled={!enabled}
            draggable={false}
            aria-label={`Add ${denom} jetons`}
            style={{ touchAction: "none", userSelect: "none" }}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Window listeners keep the drag alive if capture is rejected.
              }
              if (begin(denom, event.clientX, event.clientY)) {
                bindWindow("pointer", denom);
                bindWindow("mouse", denom);
              }
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              if (begin(denom, event.clientX, event.clientY)) bindWindow("mouse", denom);
            }}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false;
                return;
              }
              if (enabled) onTapRef.current(denom);
            }}
          >
            <span className={`chip c${denom}${drag?.denom === denom && !reducedMotion ? " chip-lift" : ""}`}>
              {denom}
            </span>
          </button>
        ))}
      </div>
      {drag ? (
        <div
          className={`drag-ghost chip c${drag.denom}${reducedMotion ? "" : " settling"}`}
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          {drag.denom}
        </div>
      ) : null}
    </>
  );
}
