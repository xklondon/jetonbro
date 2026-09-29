"use client";

export function PhoneShell({
  children,
  rightLabel,
  overlay,
  brandClassName,
  badges,
  onMenu,
}: {
  children: React.ReactNode;
  rightLabel?: string;
  overlay?: React.ReactNode;
  brandClassName?: string;
  badges?: string[];
  onMenu?: () => void;
}) {
  return (
    <div className="classic-page classic-skin">
      <section className="phone">
        <header className="top-bar">
          {overlay}
          <button className="head-button" aria-label="Menu" type="button" onClick={onMenu}>
            ☰
          </button>
          <div className={`brand${brandClassName ? ` ${brandClassName}` : ""}`}>JETONBRO</div>
          {badges?.length ? (
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
