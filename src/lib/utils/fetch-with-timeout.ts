export class TimeoutError extends Error {
  readonly name = 'TimeoutError';
  constructor(message: string = 'Request timed out') { super(message); }
}

export class NetworkError extends Error {
  readonly name = 'NetworkError';
  constructor(message: string) { super(message); }
}

export class HttpError extends Error {
  readonly name = 'HttpError';
  readonly status: number;
  readonly statusText: string;
  constructor(status: number, statusText: string, message?: string) {
    super(message || `${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchWithTimeout(input: RequestInfo | URL, options: FetchWithTimeoutOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const { timeoutMs = 15000, signal, ...rest } = options;
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const mergedSignal = signal
      ? ((): AbortSignal => {
          const ac = new AbortController();
          const onAbort = () => ac.abort();
          signal.addEventListener('abort', onAbort, { once: true });
          controller.signal.addEventListener('abort', onAbort, { once: true });
          return ac.signal;
        })()
      : controller.signal;
    const res = await fetch(input, { ...rest, signal: mergedSignal });
    return res;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new TimeoutError();
    if (e instanceof Error) throw new NetworkError(e.message);
    throw new NetworkError(String(e));
  } finally {
    clearTimeout(timer);
  }
}

