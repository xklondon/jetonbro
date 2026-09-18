"use client";

export function PlayingCard({
  rank,
  suit,
  size = "felt",
}: {
  rank: string;
  suit?: string;
  size?: "felt" | "hole" | "box";
}) {
  const red = suit === "H" || suit === "D";
  const glyph = suit === "S" ? "♠" : suit === "H" ? "♥" : suit === "D" ? "♦" : suit === "C" ? "♣" : "";
  return (
    <span className={`playing-card is-${size}${red ? " is-red" : ""}`} data-card={`${rank}${suit ?? ""}`}>
      <strong>{rank}</strong>
      {glyph ? <em>{glyph}</em> : null}
    </span>
  );
}
