"use client";

import type { ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";

/**
 * Newest / highest box number on the LEFT; Box 1 remains the rightmost centre anchor.
 * Example: [BOX 3] [BOX 2] [BOX 1]
 */
export function orderBoxesNewestLeft<T extends { boxNumber: number }>(boxes: T[]): T[] {
  return boxes.slice().sort((a, b) => b.boxNumber - a.boxNumber);
}

/**
 * Shared physical betting-box stage for Dealer and Player during Betting / Playing / Insurance.
 * Anchored ~65% down the felt. Internal horizontal scroll only — never document scroll.
 */
export function BlackjackBoxStage({
  boxes,
  children,
  footer,
}: {
  boxes: BoxView[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  const count = Math.min(Math.max(boxes.length, 1), 8);
  return (
    <div className="tt-bj-box-stage" data-box-stage="true" data-box-stage-y="lower">
      <div
        className="tt-bj-box-track"
        data-box-track="true"
        data-count={count}
        data-order="newest-left"
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
