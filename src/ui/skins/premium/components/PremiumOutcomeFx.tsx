"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_OUTCOME_FX_PREFS,
  shouldPlayOutcomeFx,
  type OutcomeFxPrefs,
} from "@/domain/tables/outcome-fx";
import { pickFunnyOutcomeFx, type FunnyFxTone } from "@/ui/core/funny-outcome-fx";
import { prefersReducedMotion } from "@/ui/core/welcome-celebration";

/** Random funny win/loss burst — table prefs + reduced motion. */
export function PremiumOutcomeFx({
  active,
  tone,
  seed,
  prefs: prefsProp,
}: {
  active: boolean;
  tone: FunnyFxTone;
  seed: string;
  prefs?: OutcomeFxPrefs | null;
}) {
  const [show, setShow] = useState(false);
  const [copy, setCopy] = useState("");
  const [motion, setMotion] = useState("pop");
  const [id, setId] = useState("fx-win-01");
  /** Latch play/pick decisions per settlement seed so snapshot polls do not re-roll. */
  const latchRef = useRef<{ seed: string; play: boolean; copy: string; motion: string; id: string } | null>(
    null,
  );

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const reduced =
      typeof window !== "undefined"
        ? prefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)"))
        : false;
    const prefs = prefsProp ?? DEFAULT_OUTCOME_FX_PREFS;
    if (!latchRef.current || latchRef.current.seed !== seed) {
      const play = shouldPlayOutcomeFx(prefs, reduced);
      if (!play) {
        latchRef.current = { seed, play: false, copy: "", motion: "pop", id: "fx-skip" };
        setShow(false);
        return;
      }
      const pick = pickFunnyOutcomeFx(tone, seed);
      latchRef.current = {
        seed,
        play: true,
        copy: pick.copy,
        motion: pick.motion,
        id: pick.id,
      };
    }
    const latch = latchRef.current;
    if (!latch.play) {
      setShow(false);
      return;
    }
    setCopy(latch.copy);
    setMotion(latch.motion);
    setId(latch.id);
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
