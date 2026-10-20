"use client";

import { useEffect, useState } from "react";
import {
  loadCelebrationPrefs,
  shouldPlayOutcomeFx,
  type CelebrationPrefs,
} from "@/ui/core/celebration-prefs";
import { pickFunnyOutcomeFx, type FunnyFxTone } from "@/ui/core/funny-outcome-fx";
import { prefersReducedMotion } from "@/ui/core/welcome-celebration";

/** Random funny win/loss burst — respects prefs + reduced motion. */
export function PremiumOutcomeFx({
  active,
  tone,
  seed,
  prefs: prefsProp,
}: {
  active: boolean;
  tone: FunnyFxTone;
  seed: string;
  prefs?: CelebrationPrefs;
}) {
  const [show, setShow] = useState(false);
  const [copy, setCopy] = useState("");
  const [motion, setMotion] = useState("pop");
  const [id, setId] = useState("fx-win-01");

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const reduced =
      typeof window !== "undefined"
        ? prefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)"))
        : false;
    const prefs = prefsProp ?? loadCelebrationPrefs(typeof localStorage !== "undefined" ? localStorage : null);
    if (!shouldPlayOutcomeFx(prefs, reduced)) {
      setShow(false);
      return;
    }
    const pick = pickFunnyOutcomeFx(tone, seed);
    setCopy(pick.copy);
    setMotion(pick.motion);
    setId(pick.id);
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 1600);
    return () => window.clearTimeout(timer);
  }, [active, tone, seed, prefsProp]);

  if (!show) return null;

  return (
    <div className={`pm-outcome-fx is-${tone} is-${motion}`} data-outcome-fx={id} aria-hidden="true">
      <span className="pm-outcome-fx-copy">{copy}</span>
    </div>
  );
}
