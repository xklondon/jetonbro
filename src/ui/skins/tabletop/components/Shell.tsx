"use client";

import type { ReactNode } from "react";
import { TableRail } from "./primitives/TableRail";

export type ShellFeltProps = Record<string, string | number | boolean | undefined>;

/**
 * Tabletop root. Compact chrome, designed felt surface with structural gold rail,
 * and bottom rail (tray / dock).
 */
export function Shell({
  children,
  rail,
  overlay,
  title,
  balance,
  badges,
  onMenu,
  menuLabel = "Menu",
  rightLabel,
  feltClassName,
  feltProps,
  hideBrand = false,
  showRail = true,
}: {
  children: ReactNode;
  rail?: ReactNode;
  overlay?: ReactNode;
  title?: string;
  balance?: string;
  badges?: string[];
  onMenu?: () => void;
  menuLabel?: string;
  rightLabel?: string;
  feltClassName?: string;
  feltProps?: ShellFeltProps;
  /** Hide header brand; table name belongs on the felt via children. */
  hideBrand?: boolean;
  /** Structural curved gold rail on the felt (default on). */
  showRail?: boolean;
}) {
  return (
    <div className="tabletop-skin" data-skin="tabletop">
      <section className="tt-phone">
        <header className="tt-top">
          <button className="tt-menu" type="button" aria-label={menuLabel} disabled={!onMenu} onClick={onMenu}>
            <span aria-hidden="true">☰</span>
          </button>
          <div className={`tt-brand${hideBrand ? " is-hidden" : ""}`}>
            {hideBrand ? null : title || "JETONBRO"}
          </div>
          {balance ? (
            <div className="tt-balance">
              <small>Balance</small>
              <strong>{balance}</strong>
            </div>
          ) : badges?.length ? (
            <div className="tt-badges" data-role-badges="true">
              {badges.map((badge) => (
                <span key={badge} className="tt-badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : (
            <span className="tt-mark" aria-hidden="true">
              {rightLabel ?? "♠"}
            </span>
          )}
        </header>
        <main className={`tt-surface tt-felt${feltClassName ? ` ${feltClassName}` : ""}`} {...feltProps}>
          {showRail ? <TableRail /> : null}
          <div className="tt-surface-body">{children}</div>
        </main>
        {rail ? <footer className="tt-rail">{rail}</footer> : <footer className="tt-rail is-empty" aria-hidden="true" />}
        {overlay}
      </section>
    </div>
  );
}
