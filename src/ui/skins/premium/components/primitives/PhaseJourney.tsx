"use client";

const STREETS = ["PRE-FLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;

function normalize(phase: string) {
  const p = phase.replaceAll("_", "-").toUpperCase();
  if (p === "HAND COMPLETE" || p === "HAND-COMPLETE") return "SHOWDOWN";
  return p;
}

export function PhaseJourney({ phase }: { phase: string }) {
  const current = normalize(phase);
  const index = STREETS.findIndex((s) => current.includes(s.replace("-", "")) || current === s || current.includes(s));
  const active = index >= 0 ? index : current.includes("FLOP") ? 1 : current.includes("TURN") ? 2 : current.includes("RIVER") ? 3 : current.includes("SHOW") || current.includes("COMPLETE") ? 4 : 0;

  return (
    <div className="pm-phase-journey" data-phase-journey="true" aria-hidden="true">
      {STREETS.map((street, i) => (
        <span
          key={street}
          className={i < active ? "is-done" : i === active ? "is-current" : undefined}
        >
          {street}
        </span>
      ))}
    </div>
  );
}
