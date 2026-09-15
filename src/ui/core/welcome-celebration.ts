export const WELCOME_CELEBRATION_KEY = "jetonbro.welcomeCelebration.played";
export const WELCOME_CELEBRATION_MS = 2200;

type WelcomeRuntime = {
  playing: boolean;
};

function runtime(target: Record<string, unknown>): WelcomeRuntime {
  const existing = target.__jetonbroWelcome as WelcomeRuntime | undefined;
  if (existing) return existing;
  const created = { playing: false };
  target.__jetonbroWelcome = created;
  return created;
}

export function prefersReducedMotion(media: { matches: boolean } | null | undefined): boolean {
  return Boolean(media?.matches);
}

export function shouldPlayWelcomeCelebration(
  storage: { getItem(key: string): string | null } | null | undefined,
  reducedMotion: boolean,
  playing = false,
): boolean {
  if (reducedMotion) return false;
  if (!storage) return false;
  if (playing) return true;
  return storage.getItem(WELCOME_CELEBRATION_KEY) !== "1";
}

export function markWelcomeCelebrationPlayed(storage: { setItem(key: string, value: string): void } | null | undefined): void {
  storage?.setItem(WELCOME_CELEBRATION_KEY, "1");
}

export function beginWelcomeCelebration(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  reducedMotion: boolean,
  memory: Record<string, unknown>,
): boolean {
  const state = runtime(memory);
  if (reducedMotion) {
    markWelcomeCelebrationPlayed(storage);
    state.playing = false;
    return false;
  }
  if (!shouldPlayWelcomeCelebration(storage, false, state.playing)) {
    return false;
  }
  state.playing = true;
  markWelcomeCelebrationPlayed(storage);
  return true;
}

export function endWelcomeCelebration(memory: Record<string, unknown>): void {
  runtime(memory).playing = false;
}
