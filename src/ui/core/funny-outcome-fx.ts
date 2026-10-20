/** Twenty lightweight funny win/loss FX picks — decorative only. */

export type FunnyFxTone = "win" | "loss";

export type FunnyFxPick = {
  id: string;
  tone: FunnyFxTone;
  copy: string;
  motion: string;
};

const WIN: Omit<FunnyFxPick, "tone">[] = [
  { id: "fx-win-01", copy: "JETONS RAIN!", motion: "confetti" },
  { id: "fx-win-02", copy: "STACK ATTACK!", motion: "bounce" },
  { id: "fx-win-03", copy: "CHIP CHAMP!", motion: "spin" },
  { id: "fx-win-04", copy: "FELT FORTUNE!", motion: "sparkle" },
  { id: "fx-win-05", copy: "BANKROLL BOOGIE!", motion: "wiggle" },
  { id: "fx-win-06", copy: "POT OF GLORY!", motion: "rise" },
  { id: "fx-win-07", copy: "DEALER'S DELIGHT!", motion: "flash" },
  { id: "fx-win-08", copy: "LUCKY LIP!", motion: "pop" },
  { id: "fx-win-09", copy: "DOUBLE NICE!", motion: "pulse" },
  { id: "fx-win-10", copy: "TABLE TITAN!", motion: "zoom" },
];

const LOSS: Omit<FunnyFxPick, "tone">[] = [
  { id: "fx-loss-01", copy: "OOF. JETONS LEFT.", motion: "shake" },
  { id: "fx-loss-02", copy: "FELT THE BURN.", motion: "droop" },
  { id: "fx-loss-03", copy: "BLUFF… BUFFED?", motion: "tilt" },
  { id: "fx-loss-04", copy: "STACK SNACKED.", motion: "shrink" },
  { id: "fx-loss-05", copy: "TOUGH RAIL.", motion: "fade" },
  { id: "fx-loss-06", copy: "NEXT HAND HERO.", motion: "shrug" },
  { id: "fx-loss-07", copy: "CHIPS TOOK A TRIP.", motion: "slide" },
  { id: "fx-loss-08", copy: "ALMOST… ALMOST.", motion: "wobble" },
  { id: "fx-loss-09", copy: "POT SAID NOPE.", motion: "bounce-out" },
  { id: "fx-loss-10", copy: "SHUFFLE IT OFF.", motion: "spin-out" },
];

export const FUNNY_OUTCOME_FX: FunnyFxPick[] = [
  ...WIN.map((item) => ({ ...item, tone: "win" as const })),
  ...LOSS.map((item) => ({ ...item, tone: "loss" as const })),
];

export function pickFunnyOutcomeFx(
  tone: FunnyFxTone,
  seed: string,
  random = Math.random,
): FunnyFxPick {
  const pool = FUNNY_OUTCOME_FX.filter((item) => item.tone === tone);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const index = pool.length ? (hash + Math.floor(random() * pool.length)) % pool.length : 0;
  return pool[index] ?? { id: "fx-win-01", tone: "win", copy: "NICE!", motion: "pop" };
}
