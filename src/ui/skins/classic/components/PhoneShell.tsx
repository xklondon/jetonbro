"use client";

export function PhoneShell({
  children,
  rightLabel,
}: {
  children: React.ReactNode;
  rightLabel?: string;
}) {
  return (
    <div className="classic-page classic-skin">
      <section className="phone">
        <header className="top-bar">
          <button className="head-button" aria-label="Menu" type="button">
            ☰
          </button>
          <div className="brand">JETONBRO</div>
          <span>{rightLabel ?? "♠"}</span>
        </header>
        {children}
      </section>
    </div>
  );
}
