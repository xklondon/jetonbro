import type { BoxOutcome } from "@/domain/blackjack/payouts";

export type CelebrationKind = "row" | "rain" | "notes" | "shimmer" | "shake" | "return";
export type CelebrationAudience = "player" | "dealer";

export type OutcomeCelebration = {
  kind: CelebrationKind;
  copy: string;
  overlay: boolean;
};

const WIN_COPY = ["WINNER!", "NICE ONE!"] as const;
const LOSS_COPY = "TOUGH LUCK";
const PUSH_COPY = "PUSH — JETONS RETURNED";

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
  audience: CelebrationAudience = "dealer",
  returnedLabel?: string | null,
): OutcomeCelebration {
  const returned = returnedLabel ? ` · ${returnedLabel}` : "";
  if (audience === "dealer") {
    const copy =
      outcome === "WON" || outcome === "BLACKJACK"
        ? `Win${returned}`
        : outcome === "LOST"
          ? "Loss"
          : PUSH_COPY;
    return { kind: "row", copy, overlay: false };
  }

  if (reducedMotion) {
    return {
      kind: outcome === "LOST" ? "shake" : outcome === "PUSH" ? "return" : "row",
      copy:
        outcome === "BLACKJACK"
          ? `BLACKJACK${returned}`
          : outcome === "WON"
            ? `${WIN_COPY[0]}${returned}`
            : outcome === "LOST"
              ? LOSS_COPY
              : PUSH_COPY,
      overlay: false,
    };
  }

  if (outcome === "PUSH") {
    return { kind: "return", copy: PUSH_COPY, overlay: true };
  }
  if (outcome === "LOST") {
    return { kind: "shake", copy: LOSS_COPY, overlay: true };
  }
  if (outcome === "BLACKJACK") {
    return { kind: "shimmer", copy: `BLACKJACK${returned}`, overlay: true };
  }
  const hash = hashSeed(seed);
  const strong = hash % 2 === 0;
  const copy = `${WIN_COPY[hash % 2] ?? WIN_COPY[0]}${returned}`;
  return { kind: strong ? "rain" : "row", copy, overlay: strong };
}

export function selectInsuranceCelebration(
  seed: string,
  won: boolean,
  reducedMotion: boolean,
  returnedLabel?: string | null,
): OutcomeCelebration {
  if (reducedMotion || !won) {
    return {
      kind: won ? "row" : "shake",
      copy: won ? `INSURANCE WON${returnedLabel ? ` · ${returnedLabel}` : ""}` : "INSURANCE LOST",
      overlay: false,
    };
  }
  return {
    kind: hashSeed(seed) % 2 === 0 ? "rain" : "shimmer",
    copy: `INSURANCE WON${returnedLabel ? ` · ${returnedLabel}` : ""}`,
    overlay: true,
  };
}
