import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTCOME_FX_PREFS,
  outcomeFxPlayChance,
  parseOutcomeFxFrequency,
  shouldPlayOutcomeFx,
} from "@/domain/tables/outcome-fx";
import { FUNNY_OUTCOME_FX, pickFunnyOutcomeFx } from "./funny-outcome-fx";

describe("outcome fx prefs", () => {
  it("defaults to on + occasional", () => {
    expect(DEFAULT_OUTCOME_FX_PREFS).toEqual({ enabled: true, frequency: "occasional" });
    expect(parseOutcomeFxFrequency(null)).toBe("occasional");
    expect(parseOutcomeFxFrequency("OCCASIONAL")).toBe("occasional");
  });

  it("frequency off or disabled never plays", () => {
    expect(outcomeFxPlayChance({ enabled: false, frequency: "always" })).toBe(0);
    expect(outcomeFxPlayChance({ enabled: true, frequency: "off" })).toBe(0);
    expect(shouldPlayOutcomeFx({ enabled: true, frequency: "always" }, true)).toBe(false);
    expect(shouldPlayOutcomeFx({ enabled: true, frequency: "off" }, false)).toBe(false);
  });

  it("always plays when frequency always and motion ok", () => {
    expect(shouldPlayOutcomeFx({ enabled: true, frequency: "always" }, false, () => 0.99)).toBe(true);
  });
});

describe("funny outcome fx", () => {
  it("exposes twenty win/loss clips", () => {
    expect(FUNNY_OUTCOME_FX).toHaveLength(20);
    expect(FUNNY_OUTCOME_FX.filter((x) => x.tone === "win")).toHaveLength(10);
    expect(FUNNY_OUTCOME_FX.filter((x) => x.tone === "loss")).toHaveLength(10);
  });

  it("picks from the requested tone", () => {
    expect(pickFunnyOutcomeFx("win", "seed-a", () => 0).tone).toBe("win");
    expect(pickFunnyOutcomeFx("loss", "seed-b", () => 0).tone).toBe("loss");
  });
});
