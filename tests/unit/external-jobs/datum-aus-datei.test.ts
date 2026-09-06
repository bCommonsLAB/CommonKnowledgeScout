/**
 * Wunschliste 4, W1 Stufe 3 — `date` aus dem Zeitstempel der Quelldatei.
 *
 * Der Negativfall ist hier der eigentliche Vertrag: Ein Rueckfall auf den
 * Dateizeitstempel bei PDFs und Dokumenten ist AUSDRUECKLICH nicht
 * gewuenscht (Median 148 Tage Abweichung). Ein falsches Datum ist schlechter
 * als ein leeres Feld, weil es als Beleg gelesen wird und der Report es nicht
 * mehr als Luecke zeigt.
 */
import { describe, expect, it } from 'vitest'
import { datumAusZeitstempel, zeitstempelTraegt } from '@/lib/external-jobs/datum-aus-datei'

const JETZT = new Date('2026-09-06T18:00:00Z')

describe('zeitstempelTraegt', () => {
  it('gilt fuer Ton und Video — dort liegt der Median bei null Tagen', () => {
    expect(zeitstempelTraegt('audio')).toBe(true)
    expect(zeitstempelTraegt('video')).toBe(true)
  })

  it('gilt fuer NICHTS sonst — PDF und Office liegen im Median 148 bzw. 4 Tage daneben', () => {
    for (const kind of ['pdf', 'docx', 'xlsx', 'pptx', 'image', 'markdown', 'link', 'unknown'] as const) {
      expect(zeitstempelTraegt(kind)).toBe(false)
    }
  })
})

describe('datumAusZeitstempel', () => {
  it('nimmt das Erstellungsdatum — es ist der Aufnahmezeitpunkt', () => {
    const r = datumAusZeitstempel({
      mediaKind: 'audio',
      erstelltAm: new Date('2025-07-16T08:30:00Z'),
      geaendertAm: new Date('2026-08-29T12:00:00Z'),
      jetzt: JETZT,
    })
    expect(r).toEqual({ datum: '2025-07-16', feld: 'erstelltAm', zeitstempel: '2025-07-16T08:30:00.000Z' })
  })

  it('faellt auf geaendertAm zurueck, wenn das Backend kein Erstellungsdatum fuehrt', () => {
    // Nextcloud liefert ueber diesen Client kein `creationdate`. Bei Ton und
    // Video ist `geaendertAm` nachgemessen brauchbar (7 von 9 innerhalb von
    // drei Tagen) — nur dort.
    const r = datumAusZeitstempel({
      mediaKind: 'video',
      geaendertAm: new Date('2025-04-24T09:15:00Z'),
      jetzt: JETZT,
    })
    expect(r).toMatchObject({ datum: '2025-04-24', feld: 'geaendertAm' })
  })

  it('gibt bei PDF und docx NICHTS zurueck, auch wenn beide Stempel da sind', () => {
    for (const kind of ['pdf', 'docx'] as const) {
      expect(
        datumAusZeitstempel({
          mediaKind: kind,
          erstelltAm: new Date('2026-08-22T10:00:00Z'),
          geaendertAm: new Date('2026-08-22T10:00:00Z'),
          jetzt: JETZT,
        }),
      ).toBeNull()
    }
  })

  it('lehnt Zeitstempel in der Zukunft ab — das ist eine kaputte Uhr, kein Ereignis', () => {
    const r = datumAusZeitstempel({
      mediaKind: 'audio',
      erstelltAm: new Date('2026-10-01T00:00:00Z'),
      jetzt: JETZT,
    })
    expect(r).toBeNull()
  })

  it('ueberspringt einen unbrauchbaren Stempel und prueft den naechsten', () => {
    const r = datumAusZeitstempel({
      mediaKind: 'audio',
      erstelltAm: new Date('1970-01-01T00:00:00Z'),
      geaendertAm: new Date('2025-06-11T07:00:00Z'),
      jetzt: JETZT,
    })
    expect(r).toMatchObject({ datum: '2025-06-11', feld: 'geaendertAm' })
  })

  it('gibt null zurueck, wenn gar kein Stempel da ist — statt heute einzusetzen', () => {
    expect(datumAusZeitstempel({ mediaKind: 'audio', jetzt: JETZT })).toBeNull()
    expect(datumAusZeitstempel({ mediaKind: 'audio', erstelltAm: new Date('kaputt'), jetzt: JETZT })).toBeNull()
  })
})
