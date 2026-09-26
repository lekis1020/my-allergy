export interface IdleScheduler {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
}

export function scheduleAfterIdle(
  callback: () => void,
  scheduler: IdleScheduler,
): () => void {
  if (scheduler.requestIdleCallback && scheduler.cancelIdleCallback) {
    const handle = scheduler.requestIdleCallback(callback, { timeout: 1000 });
    return () => scheduler.cancelIdleCallback?.(handle);
  }

  const handle = scheduler.setTimeout(callback, 0);
  return () => scheduler.clearTimeout(handle);
}
