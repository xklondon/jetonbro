"use client";

import { chipsFromMillis } from "../chips";

export type JetonSize = "sm" | "md" | "lg";

const DENOM_CLASS: Record<string, string> = {
  "5": "tt-j5",
  "10": "tt-j10",
  "25": "tt-j25",
  "50": "tt-j50",
  "100": "tt-j100",
};

/** Layered casino jeton: colour fill, edge marks, inner ring, highlight, shadow. */
export function Jeton({
  denomination,
  size = "md",
  selected = false,
  disabled = false,
  label,
}: {
  denomination: string;
  size?: JetonSize;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const tone = DENOM_CLASS[denomination] ?? "tt-jexact";
  const text = label ?? denomination;
  return (
    <span
      className={`tt-jeton tt-jeton-${size} ${tone}${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
      data-denom={denomination}
      aria-hidden={label === undefined ? true : undefined}
    >
      <span className="tt-jeton-edge" aria-hidden="true" />
      <span className="tt-jeton-ring" aria-hidden="true" />
      <span className="tt-jeton-shine" aria-hidden="true" />
      <span className="tt-jeton-face">{text}</span>
    </span>
  );
}

/** Stack of jetons derived from a stake (display only). */
export function ChipStack({
  millis,
  max = 5,
  size = "sm",
  className,
}: {
  millis: string;
  max?: number;
  size?: JetonSize;
  className?: string;
}) {
  const chips = chipsFromMillis(millis);
  const shown = chips.slice(0, max);
  return (
    <span className={`tt-chip-stack${shown.length === 0 ? " is-empty" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {shown.length === 0 ? (
        <Jeton denomination="0" size={size === "lg" ? "md" : "sm"} label="0" disabled />
      ) : (
        shown.map((chip, index) => (
          <Jeton key={`${chip.label}-${index}`} denomination={chip.label} size={size} label={chip.label} />
        ))
      )}
    </span>
  );
}
