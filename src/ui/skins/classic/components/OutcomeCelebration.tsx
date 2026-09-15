"use client";

import { selectOutcomeCelebration, type OutcomeCelebration } from "@/ui/core/outcome-celebration";

export function OutcomeCelebrationOverlay({
  celebration,
}: {
  celebration: OutcomeCelebration | null;
}) {
  if (!celebration?.overlay) return null;
  const showParticles = celebration.kind === "rain" || celebration.kind === "notes" || celebration.kind === "shimmer";
  const particles = celebration.kind === "notes" ? ["💵", "💵", "💵"] : ["●", "●", "●", "●", "●", "●"];
  return (
    <div className={`outcome-celebration ${celebration.kind}`} aria-hidden="true">
      <div className="outcome-celebration-copy">{celebration.copy}</div>
      {showParticles
        ? particles.map((item, index) => (
            <span key={index} className={`outcome-particle p${index}`} aria-hidden="true">
              {item}
            </span>
          ))
        : null}
    </div>
  );
}

export { selectOutcomeCelebration };
