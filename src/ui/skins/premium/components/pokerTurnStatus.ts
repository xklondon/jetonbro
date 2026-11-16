/**
 * Premium Poker status strip copy — presentation only.
 * Uses snapshot waitingCopy / phase instruction + authoritative toCall label.
 */
export function formatPokerTurnStatus(
  instruction: string | null | undefined,
  toCallLabel: string | null | undefined,
): string | null {
  if (!instruction) return null;
  const trimmed = instruction.trim();
  if (!/^YOUR TURN$/i.test(trimmed)) return trimmed;
  const call = toCallLabel && toCallLabel !== "0" ? toCallLabel : null;
  return call ? `YOUR TURN · TO CALL ${call}` : "YOUR TURN · CHECK";
}
