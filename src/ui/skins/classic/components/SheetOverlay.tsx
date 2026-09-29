"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function SheetOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    first?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  return (
    <div
      className={`sheet${open ? " open" : ""}`}
      role={open ? "presentation" : undefined}
      onClick={(event) => {
        if (open && event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        className="sheet-panel"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
      >
        {open ? children : null}
      </div>
    </div>
  );
}
