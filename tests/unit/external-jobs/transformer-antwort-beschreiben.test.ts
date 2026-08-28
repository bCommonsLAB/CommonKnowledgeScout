/**
 * Welle ST6 — die Fehlermeldung des Transformers muss diagnostizieren.
 *
 * Live-Befund 28.08.2026: 14 von 15 Jobs scheiterten mit
 * „Transformer lieferte kein gültiges structured_data. Response-Struktur:
 * {"status":"success","request":{"processor":"transformer",…"
 *
 * Die 500 Zeichen waren restlos vom ECHO der eigenen Anfrage belegt — samt
 * Volltext des Dokuments. Die eine Frage, auf die es ankam, blieb offen:
 * Gab es `data` überhaupt, und was stand in `structured_data`?
 *
 * Ein Fehler, der laut fehlschlägt, aber nichts verrät, ist nur die halbe
 * Miete.
 */
import { describe, expect, it } from 'vitest'
import { beschreibeAntwort } from '@/lib/external-jobs/template-run'

/** Die Antwort, an der sich die Diagnose am 28.08. die Zähne ausbiss. */
const ECHTE_ANTWORT = {
  status: 'success',
  request: {
    processor: 'transformer',
    timestamp: '2026-08-28T14:10:26.634540',
    parameters: {
      text: '--- Seite 1 ---\n10.08.26, 10:10\nProvincia Autonoma di Bolzano…'.repeat(20),
      template: '',
      template_content: '---\ndetailViewType: book\ndocType: …'.repeat(20),
    },
  },
}

describe('beschreibeAntwort', () => {
  it('nennt die Struktur statt eines Präfixes voller Echo', () => {
    const beschreibung = beschreibeAntwort(ECHTE_ANTWORT)

    expect(beschreibung).toContain('Schluessel: [status, request]')
    expect(beschreibung).toContain('KEIN `data`-Feld')
    // Der Volltext des Dokuments darf NICHT in der Meldung landen.
    expect(beschreibung).not.toContain('Provincia Autonoma')
    expect(beschreibung.length).toBeLessThan(600)
  })

  it('unterscheidet fehlendes, leeres und null structured_data', () => {
    expect(beschreibeAntwort({ data: {} })).toContain('KEIN `data.structured_data`')
    expect(beschreibeAntwort({ data: { structured_data: null } }))
      .toMatch(/ist null.*kein gueltiges JSON/)
    expect(beschreibeAntwort({ data: { structured_data: {} } })).toContain('leeres Objekt (0 Schluessel)')
    expect(beschreibeAntwort({ data: { structured_data: [1, 2] } })).toContain('Array mit 2 Eintraegen')
  })

  it('reicht eine Fehlermeldung des Dienstes durch, auch neben status=success', () => {
    const beschreibung = beschreibeAntwort({
      status: 'success', message: 'LLM output was not valid JSON', data: {},
    })
    expect(beschreibung).toContain('message="LLM output was not valid JSON"')
  })

  it('kürzt lange Dienst-Meldungen, statt die Antwort zu fluten', () => {
    expect(beschreibeAntwort({ error: 'x'.repeat(1000) }).length).toBeLessThan(400)
  })

  it('kommt mit Nicht-Objekten klar', () => {
    expect(beschreibeAntwort(null)).toContain('kein Objekt (null)')
    expect(beschreibeAntwort('kaputt')).toContain('kein Objekt (string)')
  })
})
