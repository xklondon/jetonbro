"use client";

import type { ReactNode } from "react";
import { PhoneShell } from "./PhoneShell";

export function TableShell({
  children,
  rightLabel,
  overlay,
  onMenu,
}: {
  children: ReactNode;
  rightLabel?: string;
  overlay?: ReactNode;
  onMenu?: () => void;
}) {
  return (
    <PhoneShell rightLabel={rightLabel} overlay={overlay} onMenu={onMenu}>
      {children}
    </PhoneShell>
  );
}
