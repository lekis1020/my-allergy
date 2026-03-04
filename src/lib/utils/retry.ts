export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 30000,
  jitter: true,
};

function computeDelay(attempt: number, options: Required<RetryOptions>): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponential = options.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, options.maxDelayMs);
  if (options.jitter) {
    // Full jitter: random value in [0, capped]
    return Math.random() * capped;
  }
  return capped;
}

function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;
  // Retry-After can be a number of seconds or an HTTP date
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }
  return null;
}

export async function withRetry(
  fn: () => Promise<Response>,
  options?: RetryOptions
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      const response = await fn();

      // Retry on 429 (rate limit) and 5xx server errors
      if (response.status === 429 || response.status >= 500) {
        if (attempt < opts.maxAttempts - 1) {
          const retryAfterMs = parseRetryAfter(response);
          const delayMs = retryAfterMs ?? computeDelay(attempt, opts);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < opts.maxAttempts - 1) {
        const delayMs = computeDelay(attempt, opts);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error("Request failed after maximum retries");
}
