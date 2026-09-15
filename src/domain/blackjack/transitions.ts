import { ConflictError } from "../errors";
import { FORWARD_TRANSITIONS, type RoundPhase } from "./phases";

export function assertTransition(from: RoundPhase, to: RoundPhase): void {
  if (FORWARD_TRANSITIONS[from] !== to) {
    throw new ConflictError(`Cannot move from ${from} to ${to}.`);
  }
}

export function nextPhase(from: RoundPhase): RoundPhase {
  return FORWARD_TRANSITIONS[from];
}
