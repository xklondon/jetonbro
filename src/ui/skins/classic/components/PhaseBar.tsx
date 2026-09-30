"use client";

import type { ReactNode } from "react";

export function PhaseBar({
  label,
  kicker,
  prefix,
  children,
}: {
  label: string;
  kicker?: string;
  prefix?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="phase-head">
        <span>
          {prefix ? `${prefix} · ` : null}
          <strong data-phase-heading>{label}</strong>
          {kicker ? <em className="phase-kicker">{kicker}</em> : null}
        </span>
      </div>
      {children}
    </div>
  );
}
