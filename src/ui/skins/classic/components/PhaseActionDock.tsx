"use client";

import type { ReactNode } from "react";

export function PhaseActionDock({ children }: { children: ReactNode }) {
  return (
    <div className="bank-phase-control" data-phase-action="true">
      {children}
    </div>
  );
}
