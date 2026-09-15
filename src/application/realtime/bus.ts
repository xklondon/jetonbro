/**
 * In-process pub/sub. Live SSE only reaches clients of this Node process.
 * Railway and any host must run exactly one application instance for this MVP.
 */
type Listener = (tableId: string) => void;

const listeners = new Set<Listener>();

export function publishTable(tableId: string): void {
  for (const listener of listeners) {
    listener(tableId);
  }
}

export function subscribeToTables(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
