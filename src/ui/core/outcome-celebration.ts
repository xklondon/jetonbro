import type { BoxOutcome } from "@/domain/blackjack/payouts";

export type CelebrationKind = "row" | "rain" | "notes" | "shimmer" | "shake" | "return";

export type OutcomeCelebration = {
  kind: CelebrationKind;
  copy: string;
  overlay: boolean;
};

const WIN_COPY = ["Winner!", "Nice one!", "Jetons incoming"] as const;
const LOSS_COPY = ["Tough luck", "Ouch", "Next hand"] as const;
const PUSH_COPY = "Push — jetons returned";

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function selectOutcomeCelebration(
  seed: string,
  outcome: BoxOutcome,
  reducedMotion: boolean,
): OutcomeCelebration {
  if (reducedMotion) {
    return {
      kind: outcome === "LOST" ? "shake" : outcome === "PUSH" ? "return" : "row",
      copy: outcome === "WON" || outcome === "BLACKJACK" ? WIN_COPY[0] : outcome === "LOST" ? LOSS_COPY[0] : PUSH_COPY,
      overlay: false,
    };
  }
  const n = hashSeed(seed) % 4;
  if (outcome === "PUSH") {
    return { kind: "return", copy: PUSH_COPY, overlay: false };
  }
  if (outcome === "LOST") {
    const copy = LOSS_COPY[n % LOSS_COPY.length] ?? LOSS_COPY[0];
    return { kind: n === 0 ? "row" : "shake", copy, overlay: false };
  }
  const copy = WIN_COPY[n % WIN_COPY.length] ?? WIN_COPY[0];
  if (n === 0) return { kind: "row", copy, overlay: false };
  if (n === 1) return { kind: "rain", copy, overlay: true };
  if (n === 2) return { kind: "notes", copy, overlay: true };
  return { kind: "shimmer", copy, overlay: true };
}
