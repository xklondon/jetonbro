"use client";

import type { PokerSeatView } from "@/application/queries/views";

export function moveSeatOrder(ids: string[], index: number, delta: -1 | 1): string {
  const next = [...ids];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next.join(",");
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next.join(",");
}

export function SeatOrderList({
  seats,
  onReorder,
}: {
  seats: PokerSeatView[];
  onReorder: (seatOrder: string) => void;
}) {
  const ids = seats.map((seat) => seat.userId);
  return (
    <ol className="seat-order" aria-label="Seat order">
      {seats.map((seat, index) => (
        <li key={seat.userId} className="seat-order-row">
          <span>
            {index + 1}. {seat.name}
          </span>
          <span className="seat-order-controls">
            <button
              type="button"
              aria-label={`Move ${seat.name} up`}
              disabled={index === 0}
              onClick={() => onReorder(moveSeatOrder(ids, index, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${seat.name} down`}
              disabled={index === seats.length - 1}
              onClick={() => onReorder(moveSeatOrder(ids, index, 1))}
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
