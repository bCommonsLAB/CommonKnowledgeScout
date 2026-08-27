// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Ladefehler mit Weg zur Loesung (Befund 27.08.2026).
 *
 * „Nicht authentifiziert" / „fetch failed" las sich fuer den Benutzer wie ein
 * Programmfehler. Fehlt nur die Anmeldung beim Speicher, sagt die Anzeige das
 * in Klartext und verlinkt die Einstellungen; alle anderen Fehler bleiben
 * unveraendert sichtbar.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SpeicherFehler } from '@/components/library/agent-view/werkbank/speicher-fehler'
import { SPEICHER_NICHT_VERBUNDEN, StorageError } from '@/lib/storage/types'

afterEach(() => cleanup())

describe('SpeicherFehler', () => {
  it('bietet bei fehlender Anmeldung den Weg zu den Einstellungen', () => {
    const fehler = new StorageError(
      `${SPEICHER_NICHT_VERBUNDEN}: Die Anmeldung bei OneDrive fehlt oder ist abgelaufen.`,
      'AUTH_REQUIRED',
      'lib-1',
    )
    render(<SpeicherFehler titel="Bericht nicht ladbar" error={fehler} />)
    expect(screen.getByText('Bitte beim Speicher neu anmelden')).toBeTruthy()
    const link = screen.getByRole('link', { name: /Einstellungen/ })
    expect(link.getAttribute('href')).toBe('/settings/archive')
    // Kein Alarm-Ton: es ist kein Defekt, sondern eine Handlung.
    expect(screen.queryByText(/Bericht nicht ladbar/)).toBeNull()
  })

  it('zeigt jeden anderen Fehler unveraendert — nichts wird schoengeredet', () => {
    render(<SpeicherFehler titel="Bericht nicht ladbar" error={new Error('HTTP 500 beim Provider')} />)
    expect(screen.getByText('Bericht nicht ladbar')).toBeTruthy()
    expect(screen.getByText('HTTP 500 beim Provider')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('kommt auch mit einem Nicht-Error-Wert zurecht', () => {
    render(<SpeicherFehler titel="Original nicht ladbar" error="kaputt" />)
    expect(screen.getByText('kaputt')).toBeTruthy()
  })
})
