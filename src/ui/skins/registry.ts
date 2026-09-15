import { classicSkin } from "./classic";
import type { JetonBroSkin } from "./types";

export const SKINS = {
  classic: classicSkin,
} as const;

export const ACTIVE_SKIN_ID = "classic" as const;

export function getSkin(): JetonBroSkin {
  return SKINS[ACTIVE_SKIN_ID];
}
