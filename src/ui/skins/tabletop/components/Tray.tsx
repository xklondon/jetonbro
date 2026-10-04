"use client";

import { useRef, useState } from "react";
import type { MoneyView } from "@/application/queries/views";

const DENOMS = ["5", "10", "25", "50", "100"] as const;

/**
 * Jeton tray: tap adds to the selected target, drag drops on any element matching `dropSelector`
 * (read from data-drop-box / data-drop-pot). The tray only reports gestures; the caller owns commands.
 */
export function Tray({
  enabled,
  dropSelector,
  onTap,
  onDrop,
  onHover,
}: {
  enabled: boolean;
  dropSelector: string;
  onTap: (amount: string) => void;
  onDrop?: (amount: string, targetId: string) => void;
  onHover?: (targetId: string | null) => void;
}) {
  const [drag, setDrag] = useState<{ denom: string; x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const active = useRef<string | null>(null);
  const tapRef = useRef(onTap);
  const dropRef = useRef(onDrop);
  const hoverRef = useRef(onHover);
  tapRef.current = onTap;
  dropRef.current = onDrop;
  hoverRef.current = onHover;
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function targetAt(x: number, y: number): string | null {
    const stack =
      typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
    for (const node of stack) {
      const hit = node?.closest(dropSelector) as HTMLElement | null;
      if (hit) return hit.getAttribute("data-drop-box") ?? hit.getAttribute("data-drop-pot");
    }
    return null;
  }

  function begin(denom: string, x: number, y: number) {
    if (!enabled || active.current) return false;
    skipClick.current = false;
    origin.current = { x, y };
    active.current = denom;
    setDrag({ denom, x, y });
    return true;
  }

  function bindWindow(kind: "pointer" | "mouse", denom: string) {
    const moveName = kind === "pointer" ? "pointermove" : "mousemove";
    const upName = kind === "pointer" ? "pointerup" : "mouseup";
    const move = (event: PointerEvent | MouseEvent) => {
      if (active.current !== denom || !origin.current) return;
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) skipClick.current = true;
      setDrag({ denom, x: event.clientX, y: event.clientY });
      hoverRef.current?.(targetAt(event.clientX, event.clientY));
    };
    const up = (event: PointerEvent | MouseEvent) => {
      window.removeEventListener(moveName, move as EventListener);
      window.removeEventListener(upName, up as EventListener);
      if (kind === "pointer") window.removeEventListener("pointercancel", up as EventListener);
      const current = active.current;
      const dragged = skipClick.current;
      const target = targetAt(event.clientX, event.clientY);
      active.current = null;
      origin.current = null;
      setDrag(null);
      hoverRef.current?.(null);
      if (current && dragged && target) {
        dropRef.current?.(current, target);
        return;
      }
      skipClick.current = false;
    };
    window.addEventListener(moveName, move as EventListener);
    window.addEventListener(upName, up as EventListener);
    if (kind === "pointer") window.addEventListener("pointercancel", up as EventListener);
  }

  return (
    <>
      <div className="tt-tray" data-jeton-tray="true" data-enabled={enabled ? "true" : "false"}>
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
              if (begin(denom, event.clientX, event.clientY)) bindWindow("pointer", denom);
            }}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false;
                return;
              }
              if (enabled) tapRef.current(denom);
            }}
          >
            <span className={`tt-chip tt-c${denom}${drag?.denom === denom && !reducedMotion ? " is-lift" : ""}`}>{denom}</span>
          </button>
        ))}
      </div>
      {drag ? (
        <div className={`tt-chip tt-c${drag.denom} tt-ghost`} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.denom}
        </div>
      ) : null}
    </>
  );
}

/** Permanent bottom wallet: AVAILABLE on the right, jeton tray below. */
export function Wallet({
  available,
  trayEnabled,
  dropSelector,
  onTap,
  onDrop,
  onHover,
}: {
  available: MoneyView;
  trayEnabled: boolean;
  dropSelector: string;
  onTap?: (amount: string) => void;
  onDrop?: (amount: string, targetId: string) => void;
  onHover?: (targetId: string | null) => void;
}) {
  return (
    <div className="tt-wallet" data-player-wallet="true" data-wallet-available={available.label} data-wallet-millis={available.millis}>
      <div className="tt-wallet-bar">
        <small>YOUR JETONS</small>
        <div className="tt-wallet-available">
          <small>AVAILABLE</small>
          <strong>{available.label}</strong>
        </div>
      </div>
      <Tray
        enabled={trayEnabled}
        dropSelector={dropSelector}
        onTap={(amount) => onTap?.(amount)}
        onDrop={onDrop}
        onHover={onHover}
      />
    </div>
  );
}
