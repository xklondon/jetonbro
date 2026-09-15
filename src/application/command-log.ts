export function logCommandFailure(input: {
  command: string;
  tableId: string;
  actorId: string;
  phase?: string;
  code: string;
}): void {
  console.error(
    `[jetonbro-command] command=${input.command} table=${input.tableId} actor=${input.actorId} phase=${input.phase ?? "unknown"} code=${input.code}`,
  );
}

export function logRoundEvent(input: {
  event: string;
  tableId: string;
  roundId?: string | null;
  actorId?: string | null;
  phase?: string;
  unresolvedBoxes?: number;
  unresolvedInsurance?: number;
  deadline?: string | null;
  code?: string;
}): void {
  console.info(
    `[jetonbro-round] event=${input.event} table=${input.tableId} round=${input.roundId ?? "none"} actor=${input.actorId ?? "none"} phase=${input.phase ?? "unknown"} unresolvedBoxes=${input.unresolvedBoxes ?? 0} unresolvedInsurance=${input.unresolvedInsurance ?? 0} deadline=${input.deadline ?? "none"} code=${input.code ?? "none"}`,
  );
}
