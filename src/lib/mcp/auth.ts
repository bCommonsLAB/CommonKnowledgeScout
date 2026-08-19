/**
 * @fileoverview Auth der MCP-Bruecke (Welle 5) — Bearer-Key gegen Env.
 *
 * @description
 * Pilot-Entscheidung (Testszenario §3): EIN API-Key aus `MCP_API_KEY`, der
 * als der User aus `MCP_USER_EMAIL` handelt — dasselbe Env-Token-Muster wie
 * `x-internal-token` der External-Jobs. Per-User-Keys mit Verwaltung sind
 * eine dokumentierte Ausbaustufe.
 *
 * Kein stiller Fallback: Fehlt die Konfiguration, ist die Bruecke NICHT
 * offen, sondern antwortet 503 „nicht konfiguriert" (`no-silent-fallbacks`).
 *
 * @module mcp
 */

export type McpAuthFailure = 'not_configured' | 'missing_token' | 'invalid_token'

export type McpAuthCheck =
  | { ok: true; userEmail: string }
  | { ok: false; reason: McpAuthFailure }

/** Liest das Bearer-Token aus einem Authorization-Header (Schema case-insensitiv). */
export function readBearerToken(authorizationHeader: string | null): string | null {
  if (typeof authorizationHeader !== 'string') return null
  const match = authorizationHeader.match(/^\s*Bearer\s+(.+)\s*$/i)
  return match ? match[1] : null
}

/** Reine Pruefung — Env-Werte werden vom Aufrufer injiziert (testbar). */
export function checkMcpAuth(args: {
  authorizationHeader: string | null
  configuredKey: string | undefined
  configuredUserEmail: string | undefined
}): McpAuthCheck {
  const key = args.configuredKey?.trim() ?? ''
  const userEmail = args.configuredUserEmail?.trim() ?? ''
  if (key === '' || userEmail === '') return { ok: false, reason: 'not_configured' }

  const token = readBearerToken(args.authorizationHeader)
  if (token === null) return { ok: false, reason: 'missing_token' }
  if (token !== key) return { ok: false, reason: 'invalid_token' }
  return { ok: true, userEmail }
}

/** Pruefung gegen die Prozess-Umgebung (Route-Aufrufer). */
export function checkMcpRequestAuth(request: Request): McpAuthCheck {
  return checkMcpAuth({
    authorizationHeader: request.headers.get('authorization'),
    configuredKey: process.env.MCP_API_KEY,
    configuredUserEmail: process.env.MCP_USER_EMAIL,
  })
}

const FAILURE_RESPONSES: Record<McpAuthFailure, { status: number; error: string }> = {
  not_configured: {
    status: 503,
    error: 'MCP-Bruecke nicht konfiguriert — MCP_API_KEY und MCP_USER_EMAIL in der Umgebung setzen',
  },
  missing_token: {
    status: 401,
    error: 'Nicht authentifiziert — Header "Authorization: Bearer <MCP_API_KEY>" fehlt',
  },
  invalid_token: { status: 401, error: 'Nicht authentifiziert — ungueltiger API-Key' },
}

/** HTTP-Antwort fuer eine fehlgeschlagene Pruefung. */
export function mcpAuthFailureResponse(reason: McpAuthFailure): Response {
  const { status, error } = FAILURE_RESPONSES[reason]
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
