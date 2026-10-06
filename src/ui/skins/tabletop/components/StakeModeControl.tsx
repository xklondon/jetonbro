"use client";

import { CURRENCY_SYMBOL, STAKE_CURRENCIES, type StakeCurrency } from "@/domain/stakes";

export type StakeModeValue = {
  stakeType: "FUN_ONLY" | "MONEY" | "CUSTOM";
  currencyCode: StakeCurrency;
  customRate: boolean;
  moneyBuyIn: string;
  customUnitLabel: string;
  jetonsPerCustomUnit: string;
};

export const DEFAULT_STAKE_MODE: StakeModeValue = {
  stakeType: "FUN_ONLY",
  currencyCode: "USD",
  customRate: false,
  moneyBuyIn: "10.00",
  customUnitLabel: "Dinner",
  jetonsPerCustomUnit: "50",
};

export function stakeModeToPayload(value: StakeModeValue, startingJetons: string): Record<string, string> {
  if (value.stakeType === "FUN_ONLY") {
    return { stakeType: "FUN_ONLY" };
  }
  if (value.stakeType === "CUSTOM") {
    return {
      stakeType: "CUSTOM",
      customUnitLabel: value.customUnitLabel,
      jetonsPerCustomUnit: value.jetonsPerCustomUnit,
    };
  }
  if (value.customRate) {
    return {
      stakeType: "MONEY",
      currencyCode: value.currencyCode,
      moneyBuyIn: value.moneyBuyIn,
      startingJetonsPerPlayer: startingJetons,
    };
  }
  return {
    stakeType: "MONEY",
    currencyCode: value.currencyCode,
    moneyPerJeton: "1",
    startingJetonsPerPlayer: startingJetons,
  };
}

/** Compact FUN ONLY | MONEY | SOMETHING ELSE control — presentation/validation only. */
export function StakeModeControl({
  value,
  startingJetons,
  onChange,
  onPersist,
}: {
  value: StakeModeValue;
  startingJetons: string;
  onChange: (next: StakeModeValue) => void;
  onPersist?: (payload: Record<string, string>) => void;
}) {
  const symbol = CURRENCY_SYMBOL[value.currencyCode];
  const jetonsLabel = startingJetons.trim() || "100";

  function persist(next: StakeModeValue) {
    onChange(next);
    onPersist?.(stakeModeToPayload(next, startingJetons));
  }

  function persistIfCurrent(expected: StakeModeValue["stakeType"], next: StakeModeValue) {
    if (value.stakeType !== expected) return;
    persist(next);
  }

  return (
    <div className="tt-stake-mode" data-playing-for="true" data-stake-type={value.stakeType}>
      <div className="tt-label">PLAYING FOR</div>
      <div className="tt-segment tt-stake-segments" role="group" aria-label="Playing for">
        <button
          type="button"
          className={value.stakeType === "FUN_ONLY" ? "active" : ""}
          aria-label="Fun only"
          aria-pressed={value.stakeType === "FUN_ONLY"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => persist({ ...value, stakeType: "FUN_ONLY" })}
        >
          FUN ONLY
        </button>
        <button
          type="button"
          className={value.stakeType === "MONEY" ? "active" : ""}
          aria-label="Money"
          aria-pressed={value.stakeType === "MONEY"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => persist({ ...value, stakeType: "MONEY", customRate: false })}
        >
          MONEY
        </button>
        <button
          type="button"
          className={value.stakeType === "CUSTOM" ? "active" : ""}
          aria-label="Something else"
          aria-pressed={value.stakeType === "CUSTOM"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => persist({ ...value, stakeType: "CUSTOM" })}
        >
          OTHER
        </button>
      </div>

      {value.stakeType === "MONEY" ? (
        <div className="tt-stake-money">
          <div className="tt-stake-money-row">
            <label className="tt-field tt-stake-currency">
              <span className="sr-only">Currency</span>
              <select
                className="tt-input"
                aria-label="Currency"
                value={value.currencyCode}
                onChange={(event) => {
                  const currencyCode = event.target.value as StakeCurrency;
                  persist({ ...value, currencyCode });
                }}
              >
                {STAKE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="tt-check-inline">
              <input
                type="checkbox"
                checked={value.customRate}
                aria-label="Use a custom jeton-to-money rate"
                onChange={(event) => {
                  const customRate = event.target.checked;
                  persist({ ...value, customRate });
                }}
              />
              <span>CUSTOM RATE</span>
            </label>
          </div>
          {value.customRate ? (
            <div className="tt-stake-convert-row" aria-label="Custom jeton to money rate">
              <span>
                {jetonsLabel} jetons = {symbol}
              </span>
              <input
                className="tt-input tt-stake-buyin"
                aria-label="Money buy-in for starting jetons"
                inputMode="decimal"
                value={value.moneyBuyIn}
                onChange={(event) => onChange({ ...value, moneyBuyIn: event.target.value })}
                onBlur={() => persistIfCurrent("MONEY", value)}
              />
            </div>
          ) : (
            <p className="tt-muted tt-stake-hint">1 jeton = {symbol}1</p>
          )}
        </div>
      ) : null}

      {value.stakeType === "CUSTOM" ? (
        <div className="tt-stake-custom">
          <div className="tt-stake-custom-row">
            <span>Playing for</span>
            <input
              className="tt-input"
              aria-label="Custom unit label"
              value={value.customUnitLabel}
              onChange={(event) => onChange({ ...value, customUnitLabel: event.target.value })}
              onBlur={() => persistIfCurrent("CUSTOM", value)}
            />
          </div>
          <div className="tt-stake-custom-row">
            <input
              className="tt-input tt-stake-per-unit"
              aria-label="Jetons per custom unit"
              inputMode="numeric"
              value={value.jetonsPerCustomUnit}
              onChange={(event) => onChange({ ...value, jetonsPerCustomUnit: event.target.value })}
              onBlur={() => persistIfCurrent("CUSTOM", value)}
            />
            <span>
              jetons = 1 {value.customUnitLabel.trim() || "…"}
            </span>
          </div>
          <p className="tt-muted tt-stake-hint">
            Lose {value.jetonsPerCustomUnit || "50"} jetons → owe 1 {value.customUnitLabel.trim() || "unit"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
