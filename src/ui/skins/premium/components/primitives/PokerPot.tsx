"use client";

export function PokerPot({ amount }: { amount: string }) {
  return (
    <div className="pm-poker-pot" data-poker-centre="true">
      <small>POT</small>
      <strong>{amount}</strong>
    </div>
  );
}
