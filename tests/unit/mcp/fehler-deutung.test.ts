/**
 * Welle W11 — wiederkehrende Fehlschlaege deuten statt durchreichen.
 *
 * Beleg: Sieben Bildschirmaufnahmen scheiterten reproduzierbar an der
 * Ton-Extraktion. Die Rohmeldung stand seit ST7 in job_status, aber niemand
 * las die Konsequenz daraus — also wurden sie wieder gestartet.
 */
import { describe, expect, it } from 'vitest'
import { deuteFehler } from '@/lib/mcp/fehler-deutung'

describe('deuteFehler', () => {
  it('erkennt die fehlende Tonspur an den ffmpeg-Signaturen', () => {
    for (const meldung of [
      'Output file #0 does not contain any stream',
      "Stream map '0:a' matches no streams.",
      'No audio stream found in input file',
      'Die Datei hat keine Tonspur',
    ]) {
      expect(deuteFehler([meldung])?.art).toBe('quelle_ohne_ton')
    }
  })

  it('sagt ausdruecklich, dass ein zweiter Versuch nichts bringt', () => {
    const d = deuteFehler(['Output file #0 does not contain any stream'])
    expect(d?.wiederholenSinnvoll).toBe(false)
    expect(d?.empfehlung).toContain('NICHT erneut erschliessen')
  })

  it('warnt vor einem vorhandenen Transkript — das waere erfunden', () => {
    // Der schwerwiegendere Teil des Befunds: Bei zwei Dateien hat eine
    // fruehere Transkription halluziniert statt zu scheitern.
    const d = deuteFehler(['no audio stream present'])
    expect(d?.empfehlung).toMatch(/erfundenen Text/)
  })

  it('findet die Signatur auch im Antwort-Auszug, nicht nur in der Meldung', () => {
    expect(deuteFehler([null, 'ffmpeg: Output file #0 does not contain any stream'])?.art)
      .toBe('quelle_ohne_ton')
  })

  it('raet nicht: unbekannte Fehler bleiben ohne Deutung', () => {
    expect(deuteFehler(['Template-Transformation fehlgeschlagen'])).toBeNull()
    expect(deuteFehler(['HTTP 400 from OpenRouter'])).toBeNull()
    expect(deuteFehler([])).toBeNull()
    expect(deuteFehler([null, null])).toBeNull()
  })
})
