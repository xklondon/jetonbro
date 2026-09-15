"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WELCOME_CELEBRATION_MS,
  beginWelcomeCelebration,
  endWelcomeCelebration,
  prefersReducedMotion,
} from "@/ui/core/welcome-celebration";

const KINDS = ["jeton", "coin", "note"] as const;

function buildParticles() {
  return Array.from({ length: 26 }, (_, index) => {
    const kind = index % 9 === 0 ? "note" : KINDS[index % 2];
    return {
      id: index,
      kind,
      left: `${4 + ((index * 17) % 92)}%`,
      delay: `${(index % 10) * 0.07}s`,
      duration: `${1.45 + (index % 6) * 0.12}s`,
      drift: `${(index % 2 === 0 ? -1 : 1) * (8 + (index % 5) * 3)}px`,
      spin: `${120 + (index * 37) % 240}deg`,
    };
  });
}

export function WelcomeParticles() {
  const particles = useMemo(buildParticles, []);
  return (
    <div className="welcome-celebration" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`welcome-particle welcome-particle-${particle.kind}`}
          style={{
            left: particle.left,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            ["--drift" as string]: particle.drift,
            ["--spin" as string]: particle.spin,
          }}
        />
      ))}
    </div>
  );
}

export function WelcomeCelebration({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = prefersReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)"));
    if (!beginWelcomeCelebration(window.sessionStorage, reduced, window as unknown as Record<string, unknown>)) {
      onActiveChange?.(false);
      return;
    }
    setActive(true);
    onActiveChange?.(true);
    const timer = window.setTimeout(() => {
      endWelcomeCelebration(window as unknown as Record<string, unknown>);
      setActive(false);
      onActiveChange?.(false);
    }, WELCOME_CELEBRATION_MS);
    return () => {
      window.clearTimeout(timer);
      window.setTimeout(() => endWelcomeCelebration(window as unknown as Record<string, unknown>), 0);
    };
  }, [onActiveChange]);

  if (!active) return null;
  return <WelcomeParticles />;
}
