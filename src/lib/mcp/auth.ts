/**
 * @fileoverview Auth der MCP-Bruecke (Welle 5) — Bearer-Key gegen Env.
 *
 * @description
 * Stufe 2 (Account-Keys): Bearer-Token ist ENTWEDER der Legacy-Pilot-Key
 * aus `MCP_API_KEY` (handelt als `MCP_USER_EMAIL` — dokumentierter
 * Uebergangs-Key, damit bestehende Erweiterungen weiterlaufen) ODER ein
 * signierter Account-Key aus der Datenbank (`account-key-service.ts`), der
 * als sein Inhaber handelt. `MCP_API_KEY` bleibt Pflicht: er ist zugleich
 * das Signatur-Secret der Account-Keys.
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

/** Pruefung gegen die Prozess-Umgebung (nur Legacy-Env-Key, sync). */
export function checkMcpRequestAuth(request: Request): McpAuthCheck {
  return checkMcpAuth({
    authorizationHeader: request.headers.get('authorization'),
    configuredKey: process.env.MCP_API_KEY,
    configuredUserEmail: process.env.MCP_USER_EMAIL,
  })
}

/**
 * Volle Pruefung der Route (Stufe 2): erst Legacy-Env-Key, dann Account-Key
 * aus der Datenbank. Reihenfolge bewusst — der Env-Vergleich ist billig und
 * haelt den Pilot am Leben; alles andere muss ein gueltiger, NICHT rotierter
 * Account-Key sein.
 */
export async function checkMcpRequestAuthWithAccountKeys(request: Request): Promise<McpAuthCheck> {
  const key = process.env.MCP_API_KEY?.trim() ?? ''
  if (key === '') return { ok: false, reason: 'not_configured' }

  const token = readBearerToken(request.headers.get('authorization'))
  if (token === null) return { ok: false, reason: 'missing_token' }

  const envEmail = process.env.MCP_USER_EMAIL?.trim() ?? ''
  if (token === key) {
    // Legacy-Pfad: der Env-Key handelt als MCP_USER_EMAIL — ohne die Email
    // ist er unbrauchbar (kein stiller Default-User).
    return envEmail === '' ? { ok: false, reason: 'not_configured' } : { ok: true, userEmail: envEmail }
  }

  const { resolveMcpAccountKey } = await import('./account-key-service')
  const accountEmail = await resolveMcpAccountKey(token)
  if (accountEmail === null) return { ok: false, reason: 'invalid_token' }
  return { ok: true, userEmail: accountEmail }
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
