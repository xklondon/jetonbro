"use client";

import type { ReactNode } from "react";
import { TableButton } from "./TableButton";

export type DockAction = { label: string; disabled?: boolean; onClick: () => void; addPlayer?: boolean };

/** Bottom phase-action dock: primary + secondary TableButtons. */
export function ActionDock({
  notice,
  extra,
  primary,
  secondary,
}: {
  notice?: ReactNode;
  extra?: ReactNode;
  primary?: DockAction | null;
  secondary?: DockAction | null;
}) {
  const columns = primary && secondary ? "2" : "1";
  return (
    <div className="tt-dock" data-phase-action="true">
      {notice}
      {extra}
      {primary || secondary ? (
        <div className="tt-dock-row" data-dealer-dock="true" data-dock-columns={columns}>
          {primary ? (
            <TableButton variant="primary" className="tt-dock-primary" disabled={primary.disabled} onClick={primary.onClick}>
              {primary.label}
            </TableButton>
          ) : null}
          {secondary ? (
            <TableButton
              variant="secondary"
              className="tt-dock-secondary"
              data-add-player={secondary.addPlayer ? "true" : undefined}
              disabled={secondary.disabled}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </TableButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
