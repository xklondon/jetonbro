/** Table-owned result animation prefs (shared by every seat at the table). */

export const OUTCOME_FX_FREQUENCIES = ["off", "occasional", "often", "always"] as const;

export type OutcomeFxFrequency = (typeof OUTCOME_FX_FREQUENCIES)[number];

export type OutcomeFxPrefs = {
  enabled: boolean;
  frequency: OutcomeFxFrequency;
};

export const DEFAULT_OUTCOME_FX_PREFS: OutcomeFxPrefs = {
  enabled: true,
  frequency: "occasional",
};

const FREQ_TO_DB = {
  off: "OFF",
  occasional: "OCCASIONAL",
  often: "OFTEN",
  always: "ALWAYS",
} as const;

const DB_TO_FREQ = {
  OFF: "off",
  OCCASIONAL: "occasional",
  OFTEN: "often",
  ALWAYS: "always",
} as const;

export type OutcomeFxFrequencyDb = keyof typeof DB_TO_FREQ;

export function parseOutcomeFxFrequency(
  value: unknown,
  fallback: OutcomeFxFrequency = DEFAULT_OUTCOME_FX_PREFS.frequency,
): OutcomeFxFrequency {
  if (typeof value !== "string") return fallback;
  const lower = value.trim().toLowerCase();
  if ((OUTCOME_FX_FREQUENCIES as readonly string[]).includes(lower)) {
    return lower as OutcomeFxFrequency;
  }
  const upper = value.trim().toUpperCase();
  if (upper in DB_TO_FREQ) return DB_TO_FREQ[upper as OutcomeFxFrequencyDb];
  return fallback;
}

export function outcomeFxFrequencyToDb(frequency: OutcomeFxFrequency): OutcomeFxFrequencyDb {
  return FREQ_TO_DB[frequency];
}

export function outcomeFxPrefsFromTable(table: {
  outcomeFxEnabled?: boolean | null;
  outcomeFxFrequency?: string | null;
}): OutcomeFxPrefs {
  return {
    enabled: table.outcomeFxEnabled ?? DEFAULT_OUTCOME_FX_PREFS.enabled,
    frequency: parseOutcomeFxFrequency(table.outcomeFxFrequency),
  };
}

/** Chance to play when enabled; frequency=off never plays. */
export function outcomeFxPlayChance(prefs: OutcomeFxPrefs): number {
  if (!prefs.enabled || prefs.frequency === "off") return 0;
  if (prefs.frequency === "always") return 1;
  if (prefs.frequency === "often") return 0.65;
  return 0.28; // occasional
}

export function shouldPlayOutcomeFx(
  prefs: OutcomeFxPrefs,
  reducedMotion: boolean,
  random = Math.random,
): boolean {
  if (reducedMotion) return false;
  const chance = outcomeFxPlayChance(prefs);
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return random() < chance;
}
