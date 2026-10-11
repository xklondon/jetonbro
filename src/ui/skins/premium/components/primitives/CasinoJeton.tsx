"use client";

import { chipCompositionFromMillis } from "@/domain/jetons/chips";

export type CasinoJetonSize = "sm" | "md" | "lg" | "xl";

const TONE: Record<string, string> = {
  "5": "is-5",
  "10": "is-10",
  "25": "is-25",
  "50": "is-50",
  "100": "is-100",
};

/** Layered 3D casino jeton — Premium counterpart of Tabletop Jeton (display only). */
export function CasinoJeton({
  denomination,
  size = "md",
  selected = false,
  disabled = false,
  label,
}: {
  denomination: string;
  size?: CasinoJetonSize;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const tone = TONE[denomination] ?? "is-exact";
  const text = label ?? denomination;
  return (
    <span
      className={`pm-jeton pm-jeton-${size} ${tone}${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
      data-casino-jeton="true"
      data-denom={denomination}
      data-chip-value={denomination}
      aria-hidden={label === undefined ? true : undefined}
    >
      <span className="pm-jeton-edge" aria-hidden="true" />
      <span className="pm-jeton-ring" aria-hidden="true" />
      <span className="pm-jeton-shine" aria-hidden="true" />
      <span className="pm-jeton-face">{text}</span>
    </span>
  );
}

/** Vertical stake stack from factual millis — every chip equals the MAIN total. */
export function CasinoChipStack({
  millis,
  label,
  max = 6,
  size = "xl",
  className,
}: {
  millis: string;
  label?: string;
  max?: number;
  size?: CasinoJetonSize;
  className?: string;
}) {
  let value = 0n;
  try {
    value = BigInt(millis || "0");
  } catch {
    value = 0n;
  }
  const chips = chipCompositionFromMillis(value).slice(0, max);
  const totalLabel =
    label ??
    (value > 0n
      ? String(Number(value) / 1000)
      : "0");
  const values = chips.map((chip) => chip.label);
  const stackTotal = chips.reduce((sum, chip) => sum + Number(chip.label), 0);

  return (
    <span
      className={`pm-chip-stack${chips.length === 0 ? " is-empty" : ""}${className ? ` ${className}` : ""}`}
      data-chip-stack="true"
      data-chip-stack-total={chips.length ? String(stackTotal) : "0"}
      data-chip-values={values.join("+")}
      aria-hidden="true"
      style={chips.length ? { height: `${Math.max(64, 40 + chips.length * 12)}px` } : undefined}
    >
      {chips.length === 0 ? (
        <CasinoJeton denomination="0" size="md" label="0" disabled />
      ) : (
        chips.map((chip, index) => (
          <span
            key={`${chip.label}-${index}`}
            className="pm-chip-stack-item"
            style={{ bottom: `${index * 12}px`, zIndex: index + 1 }}
          >
            <CasinoJeton denomination={chip.label} size={size} label={chip.label} />
          </span>
        ))
      )}
      <span className="sr-only">{totalLabel}</span>
    </span>
  );
}
