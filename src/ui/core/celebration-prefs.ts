/** Re-export table-owned outcome FX prefs for Premium UI. */
export {
  DEFAULT_OUTCOME_FX_PREFS as DEFAULT_CELEBRATION_PREFS,
  outcomeFxPlayChance as celebrationPlayChance,
  parseOutcomeFxFrequency,
  shouldPlayOutcomeFx,
  type OutcomeFxFrequency as CelebrationFrequency,
  type OutcomeFxPrefs as CelebrationPrefs,
} from "@/domain/tables/outcome-fx";
