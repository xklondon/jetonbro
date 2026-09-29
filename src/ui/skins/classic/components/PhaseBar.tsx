"use client";

import type { ReactNode } from "react";

export function PhaseBar({
  label,
  prefix,
  children,
}: {
  label: string;
  prefix?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="phase-head">
        <span>
          {prefix ? `${prefix} · ` : null}
          <strong data-phase-heading>{label}</strong>
        </span>
      </div>
      {children}
    </div>
  );
}
