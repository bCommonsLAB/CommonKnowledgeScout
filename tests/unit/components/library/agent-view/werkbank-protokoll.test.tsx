// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Protokoll-Reiter des Vorhabens.
 *
 * Rueckfrage 27.08.2026 („wo kann ich das Protokoll lesen?"): Das WARUM der
 * Agenten lag nur in der Datenbank und war ueber die Bruecke abrufbar. Der
 * Reiter macht es sichtbar — inklusive Fehlversuchen, denn auch die sind
 * Geschichte.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WerkbankProtokoll } from '@/components/library/agent-view/werkbank/werkbank-protokoll'

afterEach(() => cleanup())

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function zeige() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <WerkbankProtokoll libraryId="lib-1" folderId="f-pilot" />
    </QueryClientProvider>,
  )
}

function antwort(eintraege: unknown[]) {
  return { ok: true, json: async () => ({ eintraege, anzahl: eintraege.length }) }
}

describe('WerkbankProtokoll', () => {
  it('zeigt Werkzeug, Urheber und die Begruendung', async () => {
    fetchMock.mockResolvedValue(antwort([
      {
        werkzeug: 'transformation_starten',
        libraryId: 'lib-1',
        akteur: 'peter@example.org',
        begruendung: 'Transkript nach Hoerfehler-Korrektur neu transformiert',
        status: 'ok',
        createdAt: '2026-08-27T12:00:00.000Z',
      },
    ]))
    zeige()
    expect(await screen.findByText('transformation_starten')).toBeTruthy()
    expect(screen.getByText(/Hoerfehler-Korrektur/)).toBeTruthy()
    expect(screen.getByText('peter@example.org')).toBeTruthy()
  })

  it('haelt Fehlversuche fest — samt Grund', async () => {
    fetchMock.mockResolvedValue(antwort([
      {
        werkzeug: 'stand_setzen',
        libraryId: 'lib-1',
        akteur: 'peter@example.org',
        begruendung: 'Stand auf berichtet gesetzt',
        status: 'fehler',
        fehler: 'Spiegel-Drift: erst importieren',
        createdAt: '2026-08-27T12:05:00.000Z',
      },
    ]))
    zeige()
    expect(await screen.findByText('fehlgeschlagen')).toBeTruthy()
    expect(screen.getByText(/Spiegel-Drift/)).toBeTruthy()
  })

  it('erklaert den Leerzustand, statt eine leere Flaeche zu zeigen', async () => {
    fetchMock.mockResolvedValue(antwort([]))
    zeige()
    expect(await screen.findByText(/noch nichts protokolliert/)).toBeTruthy()
    expect(screen.getByText(/Deine eigenen Klicks/)).toBeTruthy()
  })

  it('meldet einen Ladefehler im Klartext', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Mongo weg' }) })
    zeige()
    expect(await screen.findByText('Protokoll nicht ladbar')).toBeTruthy()
    expect(screen.getByText('Mongo weg')).toBeTruthy()
  })
})
