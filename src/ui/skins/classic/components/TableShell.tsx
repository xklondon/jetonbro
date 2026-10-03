"use client";

import type { ReactNode } from "react";
import { PhoneShell } from "./PhoneShell";

export function TableShell({
  children,
  rightLabel,
  overlay,
  badges,
  onMenu,
  title,
  balance,
  feltIdentity = false,
}: {
  children: ReactNode;
  rightLabel?: string;
  overlay?: ReactNode;
  badges?: string[];
  onMenu?: () => void;
  title?: string;
  balance?: string;
  feltIdentity?: boolean;
}) {
  return (
    <PhoneShell
      rightLabel={rightLabel}
      overlay={overlay}
      badges={badges}
      onMenu={onMenu}
      title={title}
      balance={balance}
      feltIdentity={feltIdentity}
    >
      {children}
    </PhoneShell>
  );
}
