"use client";

import type { PokerStreetRailView } from "@/application/queries/views";

export function PokerStreetRail({ stops }: { stops: PokerStreetRailView[] }) {
  const visible = stops.filter((stop) => stop.id !== "DEAL");
  const setup = stops.some((stop) => stop.id === "DEAL" && stop.state === "current");
  if (setup || visible.length === 0) return null;
  return (
    <ol className="poker-street-rail" aria-label="Hold’em streets">
      {visible.map((stop) => (
        <li key={stop.id} className={`rail-stop is-${stop.state}`} data-rail={stop.id} data-rail-state={stop.state}>
          <span>{stop.id}</span>
        </li>
      ))}
    </ol>
  );
}
