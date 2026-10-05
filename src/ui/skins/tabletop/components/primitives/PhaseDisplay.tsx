"use client";

/** Compact phase title + optional instruction. Avoids repeating the same phase word twice. */
export function PhaseDisplay({
  display,
  label,
  instruction,
}: {
  display?: string;
  label: string;
  instruction?: string;
}) {
  const heading = label || display || "";
  const showPill = Boolean(display && heading && display.toUpperCase() !== heading.toUpperCase());
  return (
    <div className="tt-phase">
      {showPill ? <span className="tt-phase-display">{display}</span> : null}
      <strong data-phase-heading>{heading}</strong>
      {instruction ? <em>{instruction}</em> : null}
    </div>
  );
}
