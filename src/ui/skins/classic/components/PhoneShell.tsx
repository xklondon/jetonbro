"use client";

export function PhoneShell({
  children,
  rightLabel,
  overlay,
  brandClassName,
}: {
  children: React.ReactNode;
  rightLabel?: string;
  overlay?: React.ReactNode;
  brandClassName?: string;
}) {
  return (
    <div className="classic-page classic-skin">
      <section className="phone">
        <header className="top-bar">
          {overlay}
          <button className="head-button" aria-label="Menu" type="button">
            ☰
          </button>
          <div className={`brand${brandClassName ? ` ${brandClassName}` : ""}`}>JETONBRO</div>
          <span>{rightLabel ?? "♠"}</span>
        </header>
        {children}
      </section>
    </div>
  );
}
