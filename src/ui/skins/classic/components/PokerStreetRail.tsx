"use client";

import type { PokerStreetRailView } from "@/application/queries/views";

export function PokerStreetRail({ stops }: { stops: PokerStreetRailView[] }) {
  if (stops.length === 0) return null;
  return (
    <ol className="poker-street-rail" aria-label="Hold’em streets">
      {stops.map((stop) => (
        <li key={stop.id} className={`rail-stop is-${stop.state}`} data-rail={stop.id} data-rail-state={stop.state}>
          <span>{stop.id}</span>
        </li>
      ))}
    </ol>
  );
}
