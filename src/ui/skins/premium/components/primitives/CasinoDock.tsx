"use client";

import type { ReactNode } from "react";

export type DockAction = {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function CasinoDock({
  primary,
  secondary,
  notice,
  children,
}: {
  primary?: DockAction | null;
  secondary?: DockAction | null;
  notice?: ReactNode;
  children?: ReactNode;
}) {
  const single = Boolean(primary && !secondary);
  return (
    <footer className="pm-dock" data-premium-dock="true">
      {notice}
      {children}
      {primary || secondary ? (
        <div className={`pm-dock-row${single ? " is-single" : ""}`}>
          {primary ? (
            <button
              type="button"
              className="pm-btn is-primary"
              disabled={primary.disabled}
              onClick={primary.onClick}
            >
              {primary.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              className="pm-btn is-ghost"
              disabled={secondary.disabled}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </footer>
  );
}
