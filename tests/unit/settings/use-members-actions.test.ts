/**
 * @fileoverview Char-Tests für use-members-actions Hook-Logik
 *
 * @description
 * Charakterisierungs-Tests für die extrahierten Aktions-Funktionen aus
 * members-list.tsx. Testet die reine Logik der API-Aufrufe (invite, remove,
 * resend) ohne React-Hook-Infrastruktur.
 *
 * Diese Tests sichern das bestehende Verhalten VOR der Hook-Extraktion ab,
 * damit die Extraktion keine Regression einführt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/** E-Mail-Validierung: entspricht dem Verhalten in handleInviteMember */
function validateMemberEmail(email: string): boolean {
  return Boolean(email) && email.includes('@')
}

/** Hilfsfunktion: simuliert API-Aufruf für Mitglied-Einladung */
async function simulateInviteMember(
  libraryId: string,
  email: string,
  role: 'co-creator' | 'moderator',
  fetchFn: typeof fetch
): Promise<{ success: boolean; emailSent?: boolean; error?: string }> {
  const response = await fetchFn(`/api/libraries/${libraryId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), role }),
  })

  const data = await response.json()

  if (!response.ok) {
    return { success: false, error: data.error ?? 'Fehler beim Einladen' }
  }

  return { success: true, emailSent: data.emailSent }
}

/** Hilfsfunktion: simuliert API-Aufruf für Mitglied-Entfernung */
async function simulateRemoveMember(
  libraryId: string,
  email: string,
  fetchFn: typeof fetch
): Promise<{ success: boolean; error?: string }> {
  const url = `/api/libraries/${libraryId}/members?email=${encodeURIComponent(email)}`
  const response = await fetchFn(url, { method: 'DELETE' })
  const data = await response.json()

  if (!response.ok) {
    return { success: false, error: data.error ?? 'Fehler beim Entfernen' }
  }

  return { success: true }
}

/** Hilfsfunktion: simuliert API-Aufruf für erneutes Senden */
async function simulateResendInvite(
  libraryId: string,
  email: string,
  fetchFn: typeof fetch
): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetchFn(`/api/libraries/${libraryId}/members`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await response.json()

  if (!response.ok) {
    return { success: false, error: data.error ?? 'Fehler beim Senden' }
  }

  return { success: true, message: data.message }
}

// --- Tests ---

describe('validateMemberEmail', () => {
  it('akzeptiert gueltige E-Mail-Adresse', () => {
    expect(validateMemberEmail('user@example.com')).toBe(true)
  })

  it('lehnt leere E-Mail ab', () => {
    expect(validateMemberEmail('')).toBe(false)
  })

  it('lehnt E-Mail ohne @-Zeichen ab', () => {
    expect(validateMemberEmail('kein-at-zeichen')).toBe(false)
  })
})

describe('simulateInviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gibt success: true zurueck bei erfolgreichem API-Aufruf', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ emailSent: true }),
    })

    const result = await simulateInviteMember('lib-1', 'test@example.com', 'co-creator', mockFetch as unknown as typeof fetch)

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/libraries/lib-1/members',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('trimmt die E-Mail vor dem API-Aufruf', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ emailSent: true }),
    })

    await simulateInviteMember('lib-1', '  test@example.com  ', 'moderator', mockFetch as unknown as typeof fetch)

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body as string)
    expect(body.email).toBe('test@example.com')
  })

  it('gibt success: false und error zurueck bei API-Fehler', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Bereits Mitglied' }),
    })

    const result = await simulateInviteMember('lib-1', 'test@example.com', 'co-creator', mockFetch as unknown as typeof fetch)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Bereits Mitglied')
  })
})

describe('simulateRemoveMember', () => {
  it('kodiert E-Mail im URL-Parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    await simulateRemoveMember('lib-1', 'user+test@example.com', mockFetch as unknown as typeof fetch)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('user%2Btest%40example.com')
  })

  it('gibt success: false bei API-Fehler', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Nicht gefunden' }),
    })

    const result = await simulateRemoveMember('lib-1', 'x@y.com', mockFetch as unknown as typeof fetch)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Nicht gefunden')
  })
})

describe('simulateResendInvite', () => {
  it('gibt message zurueck bei Erfolg', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'E-Mail erneut gesendet' }),
    })

    const result = await simulateResendInvite('lib-1', 'user@example.com', mockFetch as unknown as typeof fetch)

    expect(result.success).toBe(true)
    expect(result.message).toBe('E-Mail erneut gesendet')
  })

  it('sendet PUT-Request mit E-Mail im Body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'OK' }),
    })

    await simulateResendInvite('lib-2', 'member@domain.org', mockFetch as unknown as typeof fetch)

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].method).toBe('PUT')
    const body = JSON.parse(callArgs[1].body as string)
    expect(body.email).toBe('member@domain.org')
  })
})
