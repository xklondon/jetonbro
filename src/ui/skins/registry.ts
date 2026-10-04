import { tabletopSkin } from "./tabletop";
import { classicSkin } from "./classic/skin";
import type { JetonBroSkin } from "./types";

/**
 * Skin registry.
 *
 * Tabletop is active: only `./tabletop` CSS side effects load.
 * Classic components stay registered via `./classic/skin` (no stylesheet imports).
 *
 * To roll back to Classic:
 * 1. set ACTIVE_SKIN_ID = "classic"
 * 2. add `import "./classic/styles";` below so Classic CSS loads
 */
export const SKINS = {
  classic: classicSkin,
  tabletop: tabletopSkin,
} as const;

export const ACTIVE_SKIN_ID = "tabletop" as keyof typeof SKINS;

export function getSkin(): JetonBroSkin {
  return SKINS[ACTIVE_SKIN_ID];
}
