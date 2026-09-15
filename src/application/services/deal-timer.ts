/**
 * Single-instance deal countdown. Listeners live on globalThis so Next.js
 * module duplication cannot start a second timer for the same table.
 */
const globalDeal = globalThis as typeof globalThis & {
  __jetonbroDealTimers?: Map<string, ReturnType<typeof setTimeout>>;
};

function timers(): Map<string, ReturnType<typeof setTimeout>> {
  if (!globalDeal.__jetonbroDealTimers) {
    globalDeal.__jetonbroDealTimers = new Map();
  }
  return globalDeal.__jetonbroDealTimers;
}

export function clearDealTimer(tableId: string): void {
  const existing = timers().get(tableId);
  if (existing) {
    clearTimeout(existing);
    timers().delete(tableId);
  }
}

export function scheduleDealTimer(tableId: string, deadline: Date, close: (tableId: string) => Promise<void>): void {
  clearDealTimer(tableId);
  const delay = Math.max(0, deadline.getTime() - Date.now()) + 25;
  const handle = setTimeout(() => {
    timers().delete(tableId);
    void close(tableId);
  }, delay);
  timers().set(tableId, handle);
}
