export interface RetryOptions {
  baseMs?: number;
  maxMs?: number;
}

// Exponential backoff: base, 2x base, 4x base ... capped at max.
export function backoffDelay(attempt: number, { baseMs = 1000, maxMs = 30000 }: RetryOptions = {}): number {
  return Math.min(baseMs * 2 ** (attempt - 1), maxMs);
}

/**
 * Runs `task` until it succeeds, waiting with exponential backoff between attempts.
 * Never throws: failures go to `onFailure`, so callers can fire and forget.
 * Returns a function that cancels any pending retry.
 */
export function retryInBackground(
  task: () => Promise<void>,
  onFailure: (error: Error, attempt: number, delayMs: number) => void,
  options: RetryOptions = {},
): () => void {
  let cancelled = false;
  let timer: NodeJS.Timeout | undefined;

  const run = async (attempt: number) => {
    if (cancelled) return;
    try {
      await task();
    } catch (err) {
      if (cancelled) return;
      const delay = backoffDelay(attempt, options);
      onFailure(err instanceof Error ? err : new Error(String(err)), attempt, delay);
      timer = setTimeout(() => void run(attempt + 1), delay);
    }
  };

  void run(1);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
