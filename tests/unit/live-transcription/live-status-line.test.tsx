// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LiveStatusLine } from '@/components/shared/live-status-line'
import type { LiveTranscriptionSnapshot } from '@/lib/live-transcription/types'

/**
 * Beweis-Ziel: Der erste Verbindungsaufbau sieht nicht wie eine Stoerung aus.
 *
 * Hintergrund: Der Ticket-Aufruf dauert gemessen 2 bis 4 Sekunden. Solange stand frueher
 * "Verbindung unterbrochen" auf dem Schirm, obwohl noch nie eine Verbindung bestand —
 * im Test am 07.09.2026 als erster Eindruck aufgefallen.
 */

function snapshot(overrides: Partial<LiveTranscriptionSnapshot>): LiveTranscriptionSnapshot {
  return {
    status: 'nimmt-auf',
    connection: 'baut-auf',
    segments: [],
    pendingText: '',
    gaps: [],
    bufferedSeconds: 0,
    elapsedMs: 0,
    error: null,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('LiveStatusLine', () => {
  it('meldet beim ersten Aufbau keine Unterbrechung', () => {
    render(<LiveStatusLine snapshot={snapshot({ connection: 'baut-auf' })} />)

    expect(screen.getByText(/Verbindung wird aufgebaut/)).toBeTruthy()
    expect(screen.queryByText(/unterbrochen/)).toBeNull()
  })

  it('meldet beim erneuten Aufbau die Unterbrechung', () => {
    render(<LiveStatusLine snapshot={snapshot({ connection: 'verbindet', bufferedSeconds: 12 })} />)

    expect(screen.getByText(/Verbindung unterbrochen/)).toBeTruthy()
    expect(screen.getByText(/12 s gepuffert/)).toBeTruthy()
  })

  it('zeigt im Normalfall die laufende Aufnahme', () => {
    render(<LiveStatusLine snapshot={snapshot({ connection: 'verbunden', elapsedMs: 72000 })} />)

    expect(screen.getByText(/Nimmt auf \(1:12\)/)).toBeTruthy()
  })
})
