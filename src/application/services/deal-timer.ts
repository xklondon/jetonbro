/**
 * Single-instance deal countdown. Listeners live on globalThis so Next.js
 * module duplication cannot start a second timer for the same table.
 */
const globalDeal = globalThis as typeof globalThis & {
  __jetonbroDealTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __jetonbroNextRoundTimers?: Map<string, ReturnType<typeof setTimeout>>;
};

function timers(): Map<string, ReturnType<typeof setTimeout>> {
  if (!globalDeal.__jetonbroDealTimers) {
    globalDeal.__jetonbroDealTimers = new Map();
  }
  return globalDeal.__jetonbroDealTimers;
}

function nextRoundTimers(): Map<string, ReturnType<typeof setTimeout>> {
  if (!globalDeal.__jetonbroNextRoundTimers) {
    globalDeal.__jetonbroNextRoundTimers = new Map();
  }
  return globalDeal.__jetonbroNextRoundTimers;
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

export function clearNextRoundTimer(tableId: string): void {
  const existing = nextRoundTimers().get(tableId);
  if (existing) {
    clearTimeout(existing);
    nextRoundTimers().delete(tableId);
  }
}

export function scheduleNextRoundTimer(
  tableId: string,
  deadline: Date,
  start: (tableId: string) => Promise<void>,
): void {
  clearNextRoundTimer(tableId);
  const delay = Math.max(0, deadline.getTime() - Date.now()) + 25;
  const handle = setTimeout(() => {
    nextRoundTimers().delete(tableId);
    void start(tableId);
  }, delay);
  nextRoundTimers().set(tableId, handle);
}
