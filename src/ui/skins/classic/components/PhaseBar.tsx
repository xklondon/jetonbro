"use client";

import type { ReactNode } from "react";

export function PhaseBar({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div>
      <div className="phase-head">
        <strong data-phase-heading>{label}</strong>
      </div>
      {children}
    </div>
  );
}
