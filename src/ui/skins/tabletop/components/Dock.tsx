"use client";

import type { ReactNode } from "react";

export type DockAction = { label: string; disabled?: boolean; onClick: () => void; addPlayer?: boolean };

/** Bottom phase-action dock: primary + secondary sit side by side in the rail. */
export function Dock({
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
            <button type="button" className="tt-btn gold tt-dock-primary" disabled={primary.disabled} onClick={primary.onClick}>
              {primary.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              className="tt-btn tt-dock-secondary"
              data-add-player={secondary.addPlayer ? "true" : undefined}
              disabled={secondary.disabled}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
