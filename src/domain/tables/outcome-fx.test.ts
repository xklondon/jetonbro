import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTCOME_FX_PREFS,
  outcomeFxFrequencyToDb,
  outcomeFxPrefsFromTable,
  parseOutcomeFxFrequency,
} from "./outcome-fx";

describe("outcomeFxPrefsFromTable", () => {
  it("defaults when columns missing", () => {
    expect(outcomeFxPrefsFromTable({})).toEqual(DEFAULT_OUTCOME_FX_PREFS);
  });

  it("maps DB enum to view prefs", () => {
    expect(
      outcomeFxPrefsFromTable({ outcomeFxEnabled: false, outcomeFxFrequency: "ALWAYS" }),
    ).toEqual({ enabled: false, frequency: "always" });
    expect(outcomeFxFrequencyToDb("occasional")).toBe("OCCASIONAL");
    expect(parseOutcomeFxFrequency("often")).toBe("often");
  });
});
