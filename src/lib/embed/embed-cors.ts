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
 * Die Lese-Routen der Galerie, die das Embed braucht
 * (`docs/refactor/modularisierung/03-audit-embed-fetches.md`, Abschnitt A),
 * und seit D12y (Owner-Entscheidung 04.10.2026) die Routen des Story-Modus:
 * Sprachmodelle, Sitzungen und Fragen (anonym ueber `X-Session-ID`) und der
 * Antwort-Stream — die einzige schreibende Route, denn eine Frage legt
 * Sitzung und Protokoll an. Anonyme Besucher der Instanz duerfen das seit je
 * fuer oeffentliche Libraries; die Freigabe laesst es nun auch dem Browser auf
 * einer fremden Seite. Loeschen, Umbenennen, Veroeffentlichen und alles
 * Angemeldete stehen hier weiter nie; `tests/unit/lib/embed/embed-cors.test.ts`
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
  // --- Story-Modus im Embed (D6b, freigegeben D12y) ---
  {
    zweck: 'Story: das Sprachmodell fuer Fragen (oeffentliche Liste)',
    methods: ['GET'],
    pattern: /^\/api\/public\/llm-models$/,
  },
  {
    zweck: 'Story: Sitzungen der anonymen Kennung (Chronik)',
    methods: ['GET'],
    pattern: /^\/api\/chat\/[^/]+\/chats$/,
  },
  {
    zweck: 'Story: Fragen einer Sitzung und das Protokoll einer Antwort (Belege, Konfig)',
    methods: ['GET'],
    pattern: /^\/api\/chat\/[^/]+\/queries(\/[^/]+)?$/,
  },
  {
    zweck: 'Story: Dokumente der Belege nachladen',
    methods: ['GET'],
    pattern: /^\/api\/chat\/[^/]+\/docs\/by-fileids$/,
  },
  {
    zweck: 'Story: eine Frage stellen — Uebersicht und Antworten; legt Sitzung und Protokoll an',
    methods: ['POST'],
    pattern: /^\/api\/chat\/[^/]+\/stream$/,
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
      // Content-Type: POST mit JSON (Graph-Kanten, Stream). X-Session-ID: die
      // anonyme Sitzungskennung des Story-Modus (D12y). Accept-Language ist fuer
      // Browser ohnehin frei; es steht hier fuer die, die trotzdem vorab fragen.
      'Access-Control-Allow-Headers': 'Content-Type, Accept-Language, X-Session-ID',
      'Access-Control-Max-Age': '86400',
    }
  }

  if (!route.methods.includes(method)) return null
  return { 'Access-Control-Allow-Origin': '*' }
}
