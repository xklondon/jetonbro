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
  if (value.stakeType === "FUN_ONLY") return { stakeType: "FUN_ONLY" };
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

/** Compact FUN / MONEY / OTHER — same payload contract as Tabletop StakeModeControl. */
export function PremiumStakeMode({
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

  return (
    <div className="pm-stake" data-playing-for="true" data-stake-type={value.stakeType}>
      <div className="pm-label">PLAYING FOR</div>
      <div className="pm-segment" role="group" aria-label="Playing for">
        <button
          type="button"
          className={value.stakeType === "FUN_ONLY" ? "is-active" : ""}
          aria-label="Fun only"
          aria-pressed={value.stakeType === "FUN_ONLY"}
          onClick={() => persist({ ...value, stakeType: "FUN_ONLY" })}
        >
          FUN ONLY
        </button>
        <button
          type="button"
          className={value.stakeType === "MONEY" ? "is-active" : ""}
          aria-label="Money"
          aria-pressed={value.stakeType === "MONEY"}
          onClick={() => persist({ ...value, stakeType: "MONEY", customRate: false })}
        >
          MONEY
        </button>
        <button
          type="button"
          className={value.stakeType === "CUSTOM" ? "is-active" : ""}
          aria-label="Something else"
          aria-pressed={value.stakeType === "CUSTOM"}
          onClick={() => persist({ ...value, stakeType: "CUSTOM" })}
        >
          OTHER
        </button>
      </div>
      {value.stakeType === "MONEY" ? (
        <div className="pm-stake-extra">
          <label>
            <span className="sr-only">Currency</span>
            <select
              className="pm-input"
              aria-label="Currency"
              value={value.currencyCode}
              onChange={(e) => persist({ ...value, currencyCode: e.target.value as StakeCurrency })}
            >
              {STAKE_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="pm-check">
            <input
              type="checkbox"
              checked={value.customRate}
              onChange={(e) => persist({ ...value, customRate: e.target.checked })}
              aria-label="Use a custom jeton-to-money rate"
            />
            Custom rate
          </label>
          {value.customRate ? (
            <label>
              Money buy-in for starting jetons
              <input
                className="pm-input"
                aria-label="Money buy-in for starting jetons"
                value={value.moneyBuyIn}
                onChange={(e) => onChange({ ...value, moneyBuyIn: e.target.value })}
                onBlur={() => onPersist?.(stakeModeToPayload(value, startingJetons))}
              />
            </label>
          ) : (
            <p className="pm-muted">
              1 jeton = {symbol}1 · {jetonsLabel} jetons
            </p>
          )}
        </div>
      ) : null}
      {value.stakeType === "CUSTOM" ? (
        <div className="pm-stake-extra pm-two">
          <label>
            Unit label
            <input
              className="pm-input"
              aria-label="Custom unit label"
              value={value.customUnitLabel}
              onChange={(e) => onChange({ ...value, customUnitLabel: e.target.value })}
              onBlur={() => onPersist?.(stakeModeToPayload(value, startingJetons))}
            />
          </label>
          <label>
            Jetons per unit
            <input
              className="pm-input"
              aria-label="Jetons per custom unit"
              value={value.jetonsPerCustomUnit}
              onChange={(e) => onChange({ ...value, jetonsPerCustomUnit: e.target.value })}
              onBlur={() => onPersist?.(stakeModeToPayload(value, startingJetons))}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
