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
  const draggingDenom = useRef<string | null>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function targetAtPoint(x: number, y: number): string | null {
    const hit = document.elementFromPoint(x, y)?.closest(dropSelector) as HTMLElement | null;
    if (!hit) return null;
    return hit.getAttribute("data-drop-box") ?? hit.getAttribute("data-drop-pot");
  }

  return (
    <>
      <div className="jetons">
        {DENOMS.map((denom) => (
          <button
            key={denom}
            type="button"
            disabled={!enabled}
            aria-label={`Add ${denom} jetons`}
            style={{ touchAction: "none" }}
            onPointerDown={(event) => {
              if (!enabled) return;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Synthetic / touch pointers may reject capture; drag still tracks by pointerId.
              }
              skipClick.current = false;
              origin.current = { x: event.clientX, y: event.clientY };
              draggingDenom.current = denom;
              setDrag({ denom, x: event.clientX, y: event.clientY });
            }}
            onPointerMove={(event) => {
              if (draggingDenom.current !== denom || !origin.current) return;
              const dist = Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y);
              if (dist > 8) skipClick.current = true;
              setDrag({ denom, x: event.clientX, y: event.clientY });
              onHover?.(targetAtPoint(event.clientX, event.clientY));
            }}
            onPointerUp={(event) => {
              const target = targetAtPoint(event.clientX, event.clientY);
              const dragged = skipClick.current;
              draggingDenom.current = null;
              origin.current = null;
              setDrag(null);
              onHover?.(null);
              if (dragged && target) {
                onDrop(denom, target);
              }
            }}
            onPointerCancel={() => {
              draggingDenom.current = null;
              origin.current = null;
              setDrag(null);
              onHover?.(null);
            }}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false;
                return;
              }
              if (enabled) onTap(denom);
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
