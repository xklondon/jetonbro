/** Client-only outcome FX prefs — localStorage, no schema migration. */

export const CELEBRATION_PREFS_KEY = "jetonbro.outcomeFx";

export type CelebrationFrequency = "off" | "occasional" | "often" | "always";

export type CelebrationPrefs = {
  enabled: boolean;
  frequency: CelebrationFrequency;
};

export const DEFAULT_CELEBRATION_PREFS: CelebrationPrefs = {
  enabled: true,
  frequency: "occasional",
};

const FREQUENCIES: CelebrationFrequency[] = ["off", "occasional", "often", "always"];

export function parseCelebrationPrefs(raw: string | null | undefined): CelebrationPrefs {
  if (!raw) return { ...DEFAULT_CELEBRATION_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<CelebrationPrefs>;
    const frequency = FREQUENCIES.includes(parsed.frequency as CelebrationFrequency)
      ? (parsed.frequency as CelebrationFrequency)
      : DEFAULT_CELEBRATION_PREFS.frequency;
    const enabled = typeof parsed.enabled === "boolean" ? parsed.enabled : true;
    return { enabled, frequency };
  } catch {
    return { ...DEFAULT_CELEBRATION_PREFS };
  }
}

export function loadCelebrationPrefs(
  storage: { getItem(key: string): string | null } | null | undefined,
): CelebrationPrefs {
  return parseCelebrationPrefs(storage?.getItem(CELEBRATION_PREFS_KEY));
}

export function saveCelebrationPrefs(
  storage: { setItem(key: string, value: string): void } | null | undefined,
  prefs: CelebrationPrefs,
): void {
  storage?.setItem(CELEBRATION_PREFS_KEY, JSON.stringify(prefs));
}

/** Chance to play when enabled; frequency=off never plays. */
export function celebrationPlayChance(prefs: CelebrationPrefs): number {
  if (!prefs.enabled || prefs.frequency === "off") return 0;
  if (prefs.frequency === "always") return 1;
  if (prefs.frequency === "often") return 0.65;
  return 0.28; // occasional
}

export function shouldPlayOutcomeFx(
  prefs: CelebrationPrefs,
  reducedMotion: boolean,
  random = Math.random,
): boolean {
  if (reducedMotion) return false;
  const chance = celebrationPlayChance(prefs);
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return random() < chance;
}
