"use client";

export function PhoneShell({
  children,
  rightLabel,
  overlay,
  brandClassName,
  badges,
  onMenu,
  title,
  balance,
}: {
  children: React.ReactNode;
  rightLabel?: string;
  overlay?: React.ReactNode;
  brandClassName?: string;
  badges?: string[];
  onMenu?: () => void;
  title?: string;
  balance?: string;
}) {
  return (
    <div className="classic-page classic-skin">
      <section className="phone">
        <header className="top-bar">
          {overlay}
          <button
            className="head-button"
            aria-label="Menu"
            type="button"
            disabled={!onMenu}
            onClick={onMenu}
          >
            ☰
          </button>
          <div
            className={`brand${title ? " is-table-title" : ""}${brandClassName ? ` ${brandClassName}` : ""}`}
            data-table-name={title || undefined}
          >
            {title || "JETONBRO"}
          </div>
          {balance ? (
            <div className="header-balance">
              <small>Balance</small>
              <strong>{balance}</strong>
            </div>
          ) : badges?.length ? (
            <div className="role-badges" data-role-badges="true">
              {badges.map((badge) => (
                <span key={badge} className="role-badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : (
            <span>{rightLabel ?? "♠"}</span>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}
