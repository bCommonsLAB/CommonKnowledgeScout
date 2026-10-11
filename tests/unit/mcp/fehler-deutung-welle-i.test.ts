/**
 * @fileoverview Unit-Tests: die vier Deutungsarten aus Welle I3.
 *
 * Live-Pruefall 08.–11.10.2026: „aborted" wurde als Vorlagenfehler gelesen,
 * `TEMPLATE_TRANSFORMATION_ERROR` mit 0 LLM-Aufrufen ebenso, ein
 * Text-Feed-Fehler als Jobfehler, „Abschluss verweigert" als neuer Fehler.
 */

import { describe, expect, it } from 'vitest'
import { deuteFehler } from '@/lib/mcp/fehler-deutung'

describe('deuteFehler — Welle I3', () => {
  it('secretary_abbruch: aborted / fetch failed / Zeitlimit → Secretary, nicht Vorlage; Wiederholen sinnvoll', () => {
    for (const meldung of ['Request aborted', 'TypeError: fetch failed (UND_ERR_HEADERS_TIMEOUT)', 'Request timed out']) {
      const d = deuteFehler([meldung])
      expect(d?.art, meldung).toBe('secretary_abbruch')
      expect(d?.wiederholenSinnvoll).toBe(true)
      expect(d?.empfehlung).toContain('batch_neustart')
    }
  })

  it('kein_llm_aufruf: TEMPLATE_TRANSFORMATION_ERROR mit 0 LLM-Aufrufen → Secretary-Konfiguration oder Modell', () => {
    const d = deuteFehler(['[TEMPLATE_TRANSFORMATION_ERROR] Transformation lieferte kein Ergebnis (0 LLM-Aufrufe, 120 ms)'])
    expect(d?.art).toBe('kein_llm_aufruf')
    expect(d?.wiederholenSinnvoll).toBe(false)
    expect(d?.empfehlung).toContain('NICHT die Vorlage')
  })

  it('kein_llm_aufruf greift NICHT ohne den Code — ein Transformer-Fehler mit Aufrufen ist etwas anderes', () => {
    expect(deuteFehler(['Transformation lieferte kein Ergebnis (0 LLM-Aufrufe)'])).toBeNull()
    expect(deuteFehler(['[TEMPLATE_TRANSFORMATION_ERROR] Schema-Fehler nach 3 LLM-Aufrufen'])).toBeNull()
  })

  it('text_feed_failed geht vor secretary_abbruch, obwohl „fetch failed" drinsteht', () => {
    const d = deuteFehler(['text_feed_failed', 'Text-Feed nicht zustellbar: fetch failed'])
    expect(d?.art).toBe('text_feed_failed')
    expect(d?.wiederholenSinnvoll).toBe(true)
  })

  it('abschluss_verweigert: Verarbeitung fertig, Job stand schon auf failed', () => {
    const d = deuteFehler(['Abschluss verweigert: Job wurde beendet (text_feed_failed): Text-Feed nicht zustellbar'])
    expect(d?.art).toBe('abschluss_verweigert')
    expect(d?.wiederholenSinnvoll).toBe(false)
    expect(d?.empfehlung).toContain('artefakt_lesen')
  })

  it('nimmt auch job.error.code und undefined-Eintraege entgegen', () => {
    expect(deuteFehler([undefined, null, 'text_feed_timeout'])?.art).toBe('text_feed_failed')
    expect(deuteFehler([undefined, null])).toBeNull()
  })

  it('quelle_ohne_ton bleibt vorrangig', () => {
    expect(deuteFehler(['aborted: Output file does not contain any stream'])?.art).toBe('quelle_ohne_ton')
  })
})
