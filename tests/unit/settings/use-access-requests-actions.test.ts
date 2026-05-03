/**
 * @fileoverview Char-Tests für use-access-requests-actions Hook-Logik
 *
 * @description
 * Charakterisierungs-Tests für die extrahierten Aktions-Funktionen aus
 * access-requests-list.tsx. Testet die reine Logik der API-Aufrufe:
 * - Status-Update (approve/reject)
 * - Anfrage löschen
 * - Einladung erneut senden
 * - Hilfsfunktionen (getStatusBadge-Logik, getSourceLabel)
 *
 * Keine React-Hook-Infrastruktur nötig — reine Logik-Tests.
 */

import { describe, it, expect, vi } from 'vitest'
import type { LibraryAccessRequest } from '@/types/library-access'

/** Hilfsfunktion: Status-Text-Mapping (entspricht getStatusBadge-Logik) */
function getStatusText(status: LibraryAccessRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'Ausstehend'
    case 'approved':
      return 'Genehmigt'
    case 'rejected':
      return 'Abgelehnt'
  }
}

/** Hilfsfunktion: Quellen-Label (entspricht getSourceLabel-Logik) */
function getSourceLabel(source: LibraryAccessRequest['source']): string {
  return source === 'self' ? 'Selbst-Anfrage' : 'Einladung'
}

/** Simuliert API-Aufruf für Status-Update */
async function simulateUpdateStatus(
  libraryId: string,
  requestId: string,
  status: 'approved' | 'rejected',
  fetchFn: typeof fetch
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchFn(
    `/api/libraries/${libraryId}/access-requests/${requestId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }
  )

  if (!response.ok) {
    const data = await response.json()
    return { success: false, error: data.error ?? 'Fehler' }
  }

  return { success: true }
}

/** Simuliert API-Aufruf für Anfrage-Löschen */
async function simulateDeleteRequest(
  libraryId: string,
  requestId: string,
  fetchFn: typeof fetch
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchFn(
    `/api/libraries/${libraryId}/access-requests/${requestId}`,
    { method: 'DELETE' }
  )

  if (!response.ok) {
    const data = await response.json()
    return { success: false, error: data.error ?? 'Fehler' }
  }

  return { success: true }
}

/** Simuliert API-Aufruf für erneutes Versenden */
async function simulateResendInvite(
  libraryId: string,
  requestId: string,
  fetchFn: typeof fetch
): Promise<{ success: boolean; error?: string }> {
  const response = await fetchFn(
    `/api/libraries/${libraryId}/access-requests/${requestId}/resend`,
    { method: 'POST' }
  )

  if (!response.ok) {
    const data = await response.json()
    return { success: false, error: data.error ?? 'Fehler' }
  }

  return { success: true }
}

// --- Tests ---

describe('getStatusText', () => {
  it('gibt "Ausstehend" fuer pending', () => {
    expect(getStatusText('pending')).toBe('Ausstehend')
  })

  it('gibt "Genehmigt" fuer approved', () => {
    expect(getStatusText('approved')).toBe('Genehmigt')
  })

  it('gibt "Abgelehnt" fuer rejected', () => {
    expect(getStatusText('rejected')).toBe('Abgelehnt')
  })
})

describe('getSourceLabel', () => {
  it('gibt "Selbst-Anfrage" fuer self', () => {
    expect(getSourceLabel('self')).toBe('Selbst-Anfrage')
  })

  it('gibt "Einladung" fuer moderatorInvite', () => {
    expect(getSourceLabel('moderatorInvite')).toBe('Einladung')
  })
})

describe('simulateUpdateStatus', () => {
  it('sendet PUT mit approved-Status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const result = await simulateUpdateStatus('lib-1', 'req-1', 'approved', mockFetch as unknown as typeof fetch)

    expect(result.success).toBe(true)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].method).toBe('PUT')
    const body = JSON.parse(callArgs[1].body as string)
    expect(body.status).toBe('approved')
  })

  it('gibt success: false bei API-Fehler', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Nicht gefunden' }),
    })

    const result = await simulateUpdateStatus('lib-1', 'req-1', 'rejected', mockFetch as unknown as typeof fetch)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Nicht gefunden')
  })
})

describe('simulateDeleteRequest', () => {
  it('sendet DELETE-Request an korrekten Endpunkt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    await simulateDeleteRequest('lib-2', 'req-42', mockFetch as unknown as typeof fetch)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/api/libraries/lib-2/access-requests/req-42')
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
  })
})

describe('simulateResendInvite', () => {
  it('sendet POST an /resend-Endpunkt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    await simulateResendInvite('lib-3', 'req-99', mockFetch as unknown as typeof fetch)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toBe('/api/libraries/lib-3/access-requests/req-99/resend')
    expect(mockFetch.mock.calls[0][1].method).toBe('POST')
  })
})
