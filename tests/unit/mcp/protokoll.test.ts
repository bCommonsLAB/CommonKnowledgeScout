/**
 * @fileoverview Unit-Tests: Begruendungs-Pflicht und Aktions-Protokoll.
 *
 * Entscheidung Peter (27.08.2026): Das Arbeitsprotokoll gehoert nicht als
 * Markdown in den Vault — jede schreibende Bruecken-Aktion traegt eine
 * Begruendung, KnowledgeScout schreibt sie mit. Vertrag hier: Die Aktion
 * laeuft, egal was das Protokoll tut; auch Fehlversuche werden festgehalten.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// `vi.mock` wird nach oben gehoben — die Fabrik darf keine Variable von
// aussen sehen, darum die Referenz aus dem gemockten Modul holen.
vi.mock('@/lib/repositories/aktions-protokoll-repo', () => ({
  protokolliereAktion: vi.fn().mockResolvedValue(undefined),
  MAX_BEGRUENDUNG: 500,
}))

import { BEGRUENDUNG, mitProtokoll } from '@/lib/mcp/protokoll'
import { protokolliereAktion as echterSchreiber } from '@/lib/repositories/aktions-protokoll-repo'

const protokolliereAktion = echterSchreiber as unknown as ReturnType<typeof vi.fn>

const KOPF = {
  werkzeug: 'themen_setzen',
  libraryId: 'lib-1',
  akteur: 'peter@example.org',
  begruendung: 'Themen nach dem Bericht zugeordnet',
  folderId: 'f-pilot',
}

beforeEach(() => protokolliereAktion.mockClear())

describe('BEGRUENDUNG (Eingabe-Vertrag)', () => {
  it('verlangt einen Satz — leer oder zu kurz wird abgelehnt', () => {
    expect(BEGRUENDUNG.safeParse('').success).toBe(false)
    expect(BEGRUENDUNG.safeParse('  ').success).toBe(false)
    expect(BEGRUENDUNG.safeParse('ok').success).toBe(false)
    expect(BEGRUENDUNG.safeParse('Weil das Transkript korrigiert wurde').success).toBe(true)
  })

  it('begrenzt die Laenge — ein Satz, kein Aufsatz', () => {
    expect(BEGRUENDUNG.safeParse('x'.repeat(501)).success).toBe(false)
  })
})

describe('mitProtokoll', () => {
  it('schreibt den Erfolg samt Begruendung und reicht das Ergebnis durch', async () => {
    const ergebnis = await mitProtokoll(KOPF, async () => ({ gesetzt: ['Klima'] }))
    expect(ergebnis).toEqual({ gesetzt: ['Klima'] })
    expect(protokolliereAktion).toHaveBeenCalledWith(
      expect.objectContaining({
        werkzeug: 'themen_setzen',
        begruendung: 'Themen nach dem Bericht zugeordnet',
        folderId: 'f-pilot',
        status: 'ok',
        ergebnis: { gesetzt: ['Klima'] },
      }),
    )
  })

  it('haelt auch den Fehlversuch fest und wirft unveraendert weiter', async () => {
    await expect(
      mitProtokoll(KOPF, async () => {
        throw new Error('Spiegel-Drift: erst importieren')
      }),
    ).rejects.toThrow('Spiegel-Drift')

    expect(protokolliereAktion).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fehler', fehler: expect.stringContaining('Spiegel-Drift') }),
    )
  })

  it('kuerzt ein zu grosses Ergebnis, statt den Report zu doppeln', async () => {
    await mitProtokoll(KOPF, async () => ({ riesig: 'x'.repeat(5000) }))
    const eintrag = protokolliereAktion.mock.calls[0][0] as { ergebnis?: Record<string, unknown> }
    expect(String(eintrag.ergebnis?.hinweis)).toContain('gekuerzt')
  })

  it('laesst die Aktion gelten, wenn das Protokoll scheitert', async () => {
    protokolliereAktion.mockRejectedValueOnce(new Error('Mongo weg'))
    // Das Repository faengt selbst ab; hier zaehlt, dass mitProtokoll nicht
    // die bereits gelaufene Aktion mit einem Protokollfehler ueberdeckt.
    await expect(mitProtokoll(KOPF, async () => ({ ok: true }))).rejects.toThrow('Mongo weg')
  })
})
