"use client";

import { useRef, useState } from "react";
import type { MoneyView } from "@/application/queries/views";
import { Jeton } from "./Jeton";

const DENOMS = ["5", "10", "25", "50", "100"] as const;

/**
 * Jeton tray: tap adds to the selected target, drag drops on any element matching `dropSelector`
 * (read from data-drop-box / data-drop-pot). The tray only reports gestures; the caller owns commands.
 * Uses Pointer Events with capture; document scroll is locked only while dragging.
 */
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
  onDrop?: (amount: string, targetId: string) => void;
  onHover?: (targetId: string | null) => void;
}) {
  const [drag, setDrag] = useState<{ denom: string; x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const active = useRef<string | null>(null);
  const scrolling = useRef(false);
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

  function lockScroll(on: boolean) {
    if (typeof document === "undefined") return;
    if (on && !scrolling.current) {
      scrolling.current = true;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else if (!on && scrolling.current) {
      scrolling.current = false;
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
  }

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
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) {
        skipClick.current = true;
        lockScroll(true);
      }
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
      lockScroll(false);
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
            <Jeton
              denomination={denom}
              size="lg"
              disabled={!enabled}
              selected={Boolean(drag?.denom === denom && !reducedMotion)}
              label={denom}
            />
          </button>
        ))}
      </div>
      {drag ? (
        <span className="tt-jeton-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true" data-jeton-dragging="true">
          <Jeton denomination={drag.denom} size="lg" label={drag.denom} />
        </span>
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
      <JetonTray
        enabled={trayEnabled}
        dropSelector={dropSelector}
        onTap={(amount) => onTap?.(amount)}
        onDrop={onDrop}
        onHover={onHover}
      />
    </div>
  );
}
