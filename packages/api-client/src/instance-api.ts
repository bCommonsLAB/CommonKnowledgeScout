/**
 * @ks/api-client/instance-api.ts
 *
 * Die Instanz, gegen die ein Modul spricht (Welle M5, Schritt Basis-URL).
 *
 * In der Voll-App liegt sie auf derselben Herkunft wie die Seite, relative
 * Pfade genuegen. Im Embed (ADR 0008) laeuft das Modul in einer fremden Seite
 * und spricht ueber das Netz mit der zentralen Instanz; dort muss vor jedem
 * `/api/…` die Basis-URL stehen. Damit das nicht an vierzig Aufrufstellen
 * einzeln passiert — und an der einundvierzigsten vergessen wird —, gibt es
 * genau einen Weg: dieses Objekt. Im Explorer-Modul verbietet
 * `tests/unit/packages/module-explorer/instanz-fetch.test.ts` jedes andere
 * `fetch`.
 *
 * Bewusst ein rohes `fetch` mit unveraenderter Response, nicht `apiFetch`:
 * Viele Aufrufer brauchen den Status-Code (429, 404, 403), und `apiFetch`
 * wirft bei jedem Nicht-OK — genau diese Unterscheidung ginge verloren.
 */

import { apiUrl, type ApiClientConfig } from './http'

export interface InstanceApi {
  /** Basis-URL ohne Schraegstrich am Ende; leer heisst: gleiche Herkunft wie die Seite. */
  readonly baseUrl: string
  /** Adresse eines API-Pfads (`/api/…`) auf der Instanz — fuer `fetch`, Bilder, Links. */
  url(path: string): string
  /** `fetch` gegen die Instanz; die Response kommt unveraendert zurueck. */
  fetch(path: string, init?: RequestInit): Promise<Response>
}

/**
 * Prueft die Basis-URL, statt eine kaputte still zu uebernehmen: Ohne Schema
 * (`knowledgescout.org`) wuerde jeder Request relativ zur fremden Seite gebaut.
 */
function normalizeBaseUrl(baseUrl: string | undefined): string {
  if (baseUrl === undefined || baseUrl === '') return ''
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error(
      `Ungueltige Basis-URL der Instanz: "${baseUrl}" — erwartet eine absolute Adresse wie "https://knowledgescout.org"`,
    )
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Basis-URL der Instanz braucht http(s), war: "${baseUrl}"`)
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`Basis-URL der Instanz darf keine Query und kein Fragment tragen, war: "${baseUrl}"`)
  }
  return baseUrl.replace(/\/+$/, '')
}

export function createInstanceApi(config: ApiClientConfig): InstanceApi {
  const baseUrl = normalizeBaseUrl(config.baseUrl)
  const bound: ApiClientConfig = { baseUrl }
  return {
    baseUrl,
    url: (path) => apiUrl(path, bound),
    // `fetch` erst beim Aufruf nachschlagen, nicht beim Erzeugen festhalten —
    // sonst griffe ein in Tests gestubbtes `fetch` nicht.
    fetch: (path, init) => fetch(apiUrl(path, bound), init),
  }
}

/**
 * Die Instanz auf derselben Herkunft wie die Seite: die Voll-App. Ein
 * benannter Wert, kein stiller Default — wer ihn setzt, sagt damit „die
 * Instanz bin ich selbst" (no-silent-fallbacks.md).
 */
export const SAME_ORIGIN_API: InstanceApi = createInstanceApi({ baseUrl: '' })
