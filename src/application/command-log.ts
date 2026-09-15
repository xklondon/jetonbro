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
