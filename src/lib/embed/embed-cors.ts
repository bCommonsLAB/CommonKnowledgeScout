/**
 * CORS fuer das Embed (M5, ADR 0008): welche Lese-Routen eine fremde Seite
 * anonym aufrufen darf und mit welchen Kopfzeilen die Instanz antwortet.
 *
 * Owner-Entscheidung 2026-09-10: jede Herkunft, aber nur oeffentliche
 * Libraries. Die Herkunft ist deshalb `*`; ob eine Library oeffentlich ist,
 * pruefen die Routen weiter selbst (anonym gibt es nur Oeffentliches, sonst
 * 401/403/404).
 *
 * Bewusst KEIN `Access-Control-Allow-Credentials`: Der Browser schickt einer
 * fremden Anfrage so keine Sitzungs-Cookies der Instanz mit, und selbst wenn,
 * duerfte die fremde Seite die Antwort nicht lesen. Das Embed ist damit
 * anonym — per Protokoll, nicht per Verabredung.
 *
 * Nur die Lese-Routen, die das Embed wirklich braucht
 * (`docs/refactor/modularisierung/03-audit-embed-fetches.md`, Abschnitt A).
 * Schreibende Routen stehen hier nie; `tests/unit/lib/embed/embed-cors.test.ts`
 * haelt das fest. Rahmenneutral, damit die Edge-Middleware es nutzen kann.
 */

export interface EmbedReadRoute {
  /** Wofuer das Embed die Route braucht — fuer alle, die die Liste pflegen. */
  zweck: string
  methods: readonly string[]
  pattern: RegExp
}

export const EMBED_READ_ROUTES: readonly EmbedReadRoute[] = [
  {
    zweck: 'Einstieg: die Library ueber ihren Slug',
    methods: ['GET'],
    pattern: /^\/api\/public\/libraries\/[^/]+$/,
  },
  {
    zweck: 'Liste, Summen und Graph-Bestand (docs), Filter (facets), Detailansicht (doc-meta)',
    methods: ['GET'],
    pattern: /^\/api\/chat\/[^/]+\/(docs|facets|doc-meta)$/,
  },
  {
    zweck: 'Graph-Kanten (Quelle A), nur lesend; POST wegen der fileIds im Body',
    methods: ['GET', 'POST'],
    pattern: /^\/api\/library\/[^/]+\/doc-relations$/,
  },
  {
    zweck: 'Zugriffspruefung bei geschuetzten Libraries — anonym immer „kein Zugriff"',
    methods: ['GET'],
    pattern: /^\/api\/libraries\/[^/]+\/access-check$/,
  },
]

/**
 * Die CORS-Kopfzeilen fuer eine Anfrage, oder `null`, wenn die Route nicht
 * fuer das Embed freigegeben ist (dann antwortet die Instanz wie bisher).
 *
 * `OPTIONS` ist der Preflight: Er nennt die Methoden genau dieser Route.
 */
export function embedCorsHeaders(method: string, pathname: string): Record<string, string> | null {
  const route = EMBED_READ_ROUTES.find((r) => r.pattern.test(pathname))
  if (!route) return null

  if (method === 'OPTIONS') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': [...route.methods, 'OPTIONS'].join(', '),
      // Content-Type: POST mit JSON (Graph-Kanten). Accept-Language ist fuer
      // Browser ohnehin frei; es steht hier fuer die, die trotzdem vorab fragen.
      'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
      'Access-Control-Max-Age': '86400',
    }
  }

  if (!route.methods.includes(method)) return null
  return { 'Access-Control-Allow-Origin': '*' }
}
