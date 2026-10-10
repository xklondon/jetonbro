import { tabletopSkin } from "./tabletop";
import { classicSkin } from "./classic/skin";
import { premiumSkin } from "./premium";
import type { JetonBroSkin } from "./types";

/**
 * Skin registry.
 *
 * Premium is active. Tabletop and Classic remain registered as rollback.
 * Classic CSS must not load while Premium/Tabletop is active.
 *
 * To roll back to Tabletop: set ACTIVE_SKIN_ID = "tabletop"
 * To roll back to Classic:
 * 1. set ACTIVE_SKIN_ID = "classic"
 * 2. add `import "./classic/styles";` below so Classic CSS loads
 */
export const SKINS = {
  classic: classicSkin,
  tabletop: tabletopSkin,
  premium: premiumSkin,
} as const;

export const ACTIVE_SKIN_ID = "premium" as keyof typeof SKINS;

export function getSkin(): JetonBroSkin {
  return SKINS[ACTIVE_SKIN_ID];
}
