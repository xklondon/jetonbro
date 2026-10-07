"use client";

/**
 * Shared Blackjack/Poker phase display: title on line 1, instruction on line 2.
 * Never side-by-side. Reserves stable height so the table does not jump.
 */
export function PhaseDisplay({
  label,
  instruction,
}: {
  label: string;
  instruction?: string;
}) {
  return (
    <div className="tt-phase" data-phase-stack="true">
      <strong data-phase-heading>{label}</strong>
      <em data-phase-instruction={instruction ? "true" : "false"}>{instruction || "\u00a0"}</em>
    </div>
  );
}
