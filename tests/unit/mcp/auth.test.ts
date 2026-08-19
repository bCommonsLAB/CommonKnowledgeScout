/**
 * @fileoverview Unit-Tests: Auth der MCP-Bruecke (Welle 5, Testszenario §5.5).
 *
 * Falscher/fehlender Key → 401; fehlende Konfiguration → Bruecke ZU (503),
 * kein stiller offener Endpunkt.
 */

import { describe, it, expect } from 'vitest'
import { checkMcpAuth, mcpAuthFailureResponse, readBearerToken } from '@/lib/mcp/auth'

const CONFIG = { configuredKey: 'geheim-123', configuredUserEmail: 'peter@example.org' }

describe('checkMcpAuth', () => {
  it('gueltiger Bearer-Key → ok mit konfiguriertem User (Positivfall)', () => {
    const result = checkMcpAuth({ ...CONFIG, authorizationHeader: 'Bearer geheim-123' })
    expect(result).toEqual({ ok: true, userEmail: 'peter@example.org' })
  })

  it('Bearer-Schema ist case-insensitiv, der Key nicht', () => {
    expect(checkMcpAuth({ ...CONFIG, authorizationHeader: 'bearer geheim-123' }).ok).toBe(true)
    expect(checkMcpAuth({ ...CONFIG, authorizationHeader: 'Bearer GEHEIM-123' })).toEqual({
      ok: false, reason: 'invalid_token',
    })
  })

  it('fehlender oder falscher Key → 401-Grund (Negativfall)', () => {
    expect(checkMcpAuth({ ...CONFIG, authorizationHeader: null })).toEqual({ ok: false, reason: 'missing_token' })
    expect(checkMcpAuth({ ...CONFIG, authorizationHeader: 'Bearer falsch' })).toEqual({
      ok: false, reason: 'invalid_token',
    })
  })

  it('ohne Konfiguration ist die Bruecke ZU — nie offen (no-silent-fallbacks)', () => {
    expect(
      checkMcpAuth({ authorizationHeader: 'Bearer x', configuredKey: undefined, configuredUserEmail: 'a@b.c' }),
    ).toEqual({ ok: false, reason: 'not_configured' })
    expect(
      checkMcpAuth({ authorizationHeader: 'Bearer x', configuredKey: 'x', configuredUserEmail: '  ' }),
    ).toEqual({ ok: false, reason: 'not_configured' })
  })
})

describe('mcpAuthFailureResponse + readBearerToken', () => {
  it('mappt Gruende auf Status-Codes (401/503)', () => {
    expect(mcpAuthFailureResponse('missing_token').status).toBe(401)
    expect(mcpAuthFailureResponse('invalid_token').status).toBe(401)
    expect(mcpAuthFailureResponse('not_configured').status).toBe(503)
  })

  it('liest nur echte Bearer-Header', () => {
    expect(readBearerToken('Bearer abc')).toBe('abc')
    expect(readBearerToken('Basic abc')).toBeNull()
    expect(readBearerToken(null)).toBeNull()
  })
})
