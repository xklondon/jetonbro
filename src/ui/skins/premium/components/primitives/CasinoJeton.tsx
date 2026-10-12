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

/**
 * Layered clay casino jeton — Premium counterpart of Tabletop Jeton.
 * Structure: thickness lip + rim spots + inset core + ring + shine + face.
 */
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
      <span className="pm-jeton-lip" aria-hidden="true" />
      <span className="pm-jeton-surface" aria-hidden="true">
        <span className="pm-jeton-edge" />
        <span className="pm-jeton-inset" />
        <span className="pm-jeton-ring" />
        <span className="pm-jeton-shine" />
      </span>
      <span className="pm-jeton-face">{text}</span>
    </span>
  );
}

export type StackChip = { label: string; index: number };

/** Vertical stake stack from factual millis — every chip equals the MAIN total. */
export function CasinoChipStack({
  millis,
  label,
  max = 6,
  size = "xl",
  className,
  onRetractChip,
  retractBusy = false,
}: {
  millis: string;
  label?: string;
  max?: number;
  size?: CasinoJetonSize;
  className?: string;
  /** Retract one factual chip denomination via existing placeBet RETRACT. */
  onRetractChip?: (amountLabel: string) => void;
  retractBusy?: boolean;
}) {
  let value = 0n;
  try {
    value = BigInt(millis || "0");
  } catch {
    value = 0n;
  }
  const chips = chipCompositionFromMillis(value).slice(0, max);
  const totalLabel =
    label ?? (value > 0n ? String(Number(value) / 1000) : "0");
  const values = chips.map((chip) => chip.label);
  const stackTotal = chips.reduce((sum, chip) => sum + Number(chip.label), 0);
  const step = size === "xl" ? 11 : size === "lg" ? 9 : 7;

  return (
    <span
      className={`pm-chip-stack${chips.length === 0 ? " is-empty" : ""}${className ? ` ${className}` : ""}`}
      data-chip-stack="true"
      data-chip-stack-total={chips.length ? String(stackTotal) : "0"}
      data-chip-values={values.join("+")}
      style={chips.length ? { height: `${Math.max(56, 36 + chips.length * step)}px` } : undefined}
    >
      {chips.length === 0 ? (
        <CasinoJeton denomination="0" size="md" label="0" disabled />
      ) : (
        chips.map((chip, index) => (
          <span
            key={`${chip.label}-${index}`}
            className="pm-chip-stack-item"
            style={{ bottom: `${index * step}px`, zIndex: index + 1 }}
          >
            <CasinoJeton denomination={chip.label} size={size} label={chip.label} />
            {onRetractChip ? (
              <button
                type="button"
                className="pm-jeton-retract"
                data-retract-chip={chip.label}
                aria-label={`Retract ${chip.label} jetons`}
                disabled={retractBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!retractBusy) onRetractChip(chip.label);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </span>
        ))
      )}
      <span className="sr-only">{totalLabel}</span>
    </span>
  );
}
