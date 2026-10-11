export class TimeoutError extends Error {
  readonly name = 'TimeoutError';
  constructor(message: string = 'Request timed out') { super(message); }
}

export class NetworkError extends Error {
  readonly name = 'NetworkError';
  constructor(message: string, options?: { cause?: unknown }) { super(message, options); }
}

/**
 * Welle I3: Node meldet Netzfehler als „fetch failed" und haengt die Ursache
 * (ECONNREFUSED, UND_ERR_HEADERS_TIMEOUT, Zertifikat …) an `cause`. Ohne sie
 * stand im Job nur „fetch failed" — und niemand konnte Secretary-Abbruch von
 * DNS-Fehler unterscheiden.
 */
export function meldungMitUrsache(e: Error): string {
  const cause = (e as { cause?: unknown }).cause
  if (cause === undefined || cause === null) return e.message
  const c = cause as { code?: unknown; message?: unknown }
  const code = typeof c.code === 'string' ? c.code : null
  const message = typeof c.message === 'string' ? c.message : (typeof cause === 'string' ? cause : null)
  const teile = [code, message].filter((t): t is string => !!t && t !== e.message)
  return teile.length > 0 ? `${e.message} (${teile.join(': ')})` : e.message
}

export class HttpError extends Error {
  readonly name = 'HttpError';
  readonly status: number;
  readonly statusText: string;
  readonly responseBody?: unknown;
  constructor(status: number, statusText: string, message?: string, responseBody?: unknown) {
    super(message || `${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
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
    if (e instanceof Error) throw new NetworkError(meldungMitUrsache(e), { cause: (e as { cause?: unknown }).cause });
    throw new NetworkError(String(e));
  } finally {
    clearTimeout(timer);
  }
}


