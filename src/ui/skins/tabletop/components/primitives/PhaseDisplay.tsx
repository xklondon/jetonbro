"use client";

/** Compact phase pill + title + optional instruction. */
export function PhaseDisplay({
  display,
  label,
  instruction,
}: {
  display?: string;
  label: string;
  instruction?: string;
}) {
  return (
    <div className="tt-phase">
      {display ? <span className="tt-phase-display">{display}</span> : null}
      <strong data-phase-heading>{label}</strong>
      {instruction ? <em>{instruction}</em> : null}
    </div>
  );
}
