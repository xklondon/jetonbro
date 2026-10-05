/** Pure state machine for one-shot Player result celebrations. */
export function nextCelebrateClass(
  prev: string | null | undefined,
  outcome: string | null | undefined,
): { nextPrev: string | null; celebrate: string | null } {
  if (prev === undefined) {
    return { nextPrev: outcome ?? null, celebrate: null };
  }
  if (outcome && outcome !== prev) {
    return { nextPrev: outcome, celebrate: `is-celebrate-${outcome.toLowerCase()}` };
  }
  if (!outcome) {
    return { nextPrev: null, celebrate: null };
  }
  return { nextPrev: prev, celebrate: null };
}
