/**
 * In-process pub/sub. Live SSE only reaches clients of this Node process.
 * Railway and any host must run exactly one application instance for this MVP.
 *
 * Listeners live on globalThis so Next.js module duplication (dev HMR /
 * separate route compiler graphs) still shares one subscriber set.
 */
type Listener = (tableId: string) => void;

const globalBus = globalThis as typeof globalThis & {
  __jetonbroTableListeners?: Set<Listener>;
};

function listeners(): Set<Listener> {
  if (!globalBus.__jetonbroTableListeners) {
    globalBus.__jetonbroTableListeners = new Set();
  }
  return globalBus.__jetonbroTableListeners;
}

export function publishTable(tableId: string): void {
  for (const listener of listeners()) {
    listener(tableId);
  }
}

export function subscribeToTables(listener: Listener): () => void {
  listeners().add(listener);
  return () => {
    listeners().delete(listener);
  };
}
