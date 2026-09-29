"use client";

import type { ReactNode } from "react";
import { PhoneShell } from "./PhoneShell";

export function TableShell({
  children,
  rightLabel,
  overlay,
  badges,
  onMenu,
}: {
  children: ReactNode;
  rightLabel?: string;
  overlay?: ReactNode;
  badges?: string[];
  onMenu?: () => void;
}) {
  return (
    <PhoneShell rightLabel={rightLabel} overlay={overlay} badges={badges} onMenu={onMenu}>
      {children}
    </PhoneShell>
  );
}
