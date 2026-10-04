import { classicSkin } from "./classic";
import { tabletopSkin } from "./tabletop";
import type { JetonBroSkin } from "./types";

export const SKINS = {
  classic: classicSkin,
  tabletop: tabletopSkin,
} as const;

/** Tabletop is the default skin. Classic stays registered as the rollback skin. */
export const ACTIVE_SKIN_ID = "tabletop" as const;

export function getSkin(): JetonBroSkin {
  return SKINS[ACTIVE_SKIN_ID];
}
