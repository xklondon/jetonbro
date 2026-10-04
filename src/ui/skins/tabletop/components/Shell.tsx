"use client";

import type { ReactNode } from "react";

export type ShellFeltProps = Record<string, string | number | boolean | undefined>;

/**
 * Tabletop root. One physical table: compact chrome on top, a single continuous felt
 * between the chrome and the bottom rail, and the rail (tray / dock) anchored below.
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
  /** Poker prints the table name once on the cloth, so the header brand stays empty. */
  hideBrand?: boolean;
}) {
  return (
    <div className="tabletop-skin" data-skin="tabletop">
      <section className="tt-phone">
        <header className="tt-top">
          <button className="tt-menu" type="button" aria-label={menuLabel} disabled={!onMenu} onClick={onMenu}>
            <span aria-hidden="true">☰</span>
          </button>
          <div className={`tt-brand${hideBrand ? " is-hidden" : ""}`} data-table-name={hideBrand ? undefined : title || undefined}>
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
        <main className={`tt-felt${feltClassName ? ` ${feltClassName}` : ""}`} {...feltProps}>
          {children}
        </main>
        {rail ? <footer className="tt-rail">{rail}</footer> : <footer className="tt-rail is-empty" aria-hidden="true" />}
        {overlay}
      </section>
    </div>
  );
}
