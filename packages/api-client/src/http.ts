/**
 * @ks/api-client/http.ts
 *
 * Minimaler typisierter Fetch-Helper fuer die Core-API (Welle M2). Kein
 * stiller Fallback (no-silent-fallbacks.md): ein Nicht-OK-Response wirft
 * immer einen Error mit der Server-Fehlermeldung, statt `null`/`undefined`
 * zurueckzugeben.
 */
export interface ApiClientConfig {
  /** Basis-URL fuer alle Requests. Leer = relative Pfade (Voll-App, Default). */
  baseUrl?: string
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'error' in body) {
      const { error } = body as { error?: unknown }
      if (typeof error === 'string' && error.trim() !== '') return error
    }
  } catch {
    // Kein JSON-Body — Standard-Meldung unten verwenden.
  }
  return `HTTP-Fehler: ${response.status}`
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  config?: ApiClientConfig,
): Promise<T> {
  const url = `${config?.baseUrl ?? ''}${path}`
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
  return response.json() as Promise<T>
}

export function apiGet<T>(path: string, config?: ApiClientConfig): Promise<T> {
  return apiFetch<T>(path, undefined, config)
}

export function apiPost<T>(path: string, body: unknown, config?: ApiClientConfig): Promise<T> {
  return apiFetch<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    config,
  )
}
