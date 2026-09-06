/**
 * Welle W10 — `date` aus dem Ablagepfad, erweitert um W1b (Wunschliste 4).
 *
 * Beleg: rund 360 von 1.440 Befunden bibliotheksweit sind fehlende
 * `date`-Felder, und in fast allen Faellen steht das Datum im Ordnernamen.
 *
 * Die Gegenprobe ist wichtiger als der Normalfall: Die Vorhabensordner dieses
 * Archivs heissen `26.01`, `24.09`, `23.12` — als Datum gelesen waere das ein
 * Feld voller erfundener Termine.
 */
import { describe, expect, it } from 'vitest'
import { datumAusPfad, datumAusSegment, monatAusSegment, tagAusSegment } from '@/lib/external-jobs/datum-aus-pfad'
import { dateFehlt } from '@/lib/external-jobs/datum-aus-pfad'

describe('tagAusSegment', () => {
  it('liest das ISO-Datum aus einem Ordnernamen', () => {
    expect(tagAusSegment('2025-07-16 Besprechung mit Jonas')).toBe('2025-07-16')
    expect(tagAusSegment('2025_07_16 Notiz')).toBe('2025-07-16')
    expect(tagAusSegment('2025.07.16')).toBe('2025-07-16')
  })

  it('liest die deutsche Form mit vierstelligem Jahr', () => {
    expect(tagAusSegment('Protokoll 16.07.2025.md')).toBe('2025-07-16')
  })

  it('liest die deutsche Form auch ein-/zweistellig (W1b)', () => {
    expect(tagAusSegment('Villa Berta 8.10.2024')).toBe('2024-10-08')
    expect(tagAusSegment('Pluribar 21.05.2024')).toBe('2024-05-21')
    expect(tagAusSegment('Termin 3.4.2025')).toBe('2025-04-03')
  })

  it('liest KEINE Vorhabensnummer als Datum', () => {
    // Genau hier scheitert eine naive Fassung: 24.09 waere der 24. September.
    expect(tagAusSegment('26.01 Klimamassnahmen Suedtirol')).toBeNull()
    expect(tagAusSegment('24.09')).toBeNull()
    expect(tagAusSegment('23.12 Jahresabschluss')).toBeNull()
  })

  it('liest die dreiteilige Form mit zweistelligem Jahr NICHT — sie ist nicht aufloesbar', () => {
    // `25.06.11`: nach Archiv-Konvention der 11.06.2025, als deutsches Datum
    // der 25.06.2011. Vierzehn Jahre Unterschied, kein Beleg fuer eine Lesart.
    expect(tagAusSegment('25.06.11 Verwaltungsrat Sitzung')).toBeNull()
    expect(datumAusSegment('25.06.11 Verwaltungsrat Sitzung')).toBeNull()
  })

  it('liest keine blanke Ziffernfolge — die ist im Zweifel eine Nummer', () => {
    expect(tagAusSegment('20250716')).toBeNull()
    expect(tagAusSegment('Rechnung 20250716123')).toBeNull()
  })

  it('lehnt Tage ab, die es nicht gibt', () => {
    expect(tagAusSegment('2025-02-30 Termin')).toBeNull()
    expect(tagAusSegment('2025-13-01 Termin')).toBeNull()
  })

  it('lehnt unplausible Jahre ab', () => {
    expect(tagAusSegment('1899-07-16')).toBeNull()
    expect(tagAusSegment('2525-07-16')).toBeNull()
  })
})

describe('monatAusSegment (W1b)', () => {
  it('liest `JJJJ-MM` als Monatsersten', () => {
    expect(monatAusSegment('2025-07 Rueckblick')).toBe('2025-07-01')
    expect(monatAusSegment('2024-11')).toBe('2024-11-01')
  })

  it('schneidet KEIN taggenaues Datum auf den Monat zurecht', () => {
    expect(monatAusSegment('2025-07-16 Besprechung')).toBeNull()
  })

  it('liest weder Jahresspannen noch Vorhabensnummern', () => {
    expect(monatAusSegment('2024-2025 Jahresbericht')).toBeNull()
    expect(monatAusSegment('26.01 Klimamassnahmen')).toBeNull()
    expect(monatAusSegment('2025-13 Etwas')).toBeNull()
  })
})

describe('datumAusSegment', () => {
  it('meldet die Genauigkeit mit — taggenau vor monatsgenau', () => {
    expect(datumAusSegment('2025-07-16 Besprechung')).toEqual({ datum: '2025-07-16', genauigkeit: 'tag' })
    expect(datumAusSegment('2025-07 Rueckblick')).toEqual({ datum: '2025-07-01', genauigkeit: 'monat' })
  })
})

describe('datumAusPfad', () => {
  it('nimmt das spezifischste Segment — der Dateiname schlaegt den Ordner', () => {
    const r = datumAusPfad('4. Aktivismus/2025-01-02 Auftakt/2025-07-16 Protokoll.md')
    expect(r).toEqual({ datum: '2025-07-16', segment: '2025-07-16 Protokoll.md', genauigkeit: 'tag' })
  })

  it('faellt auf den Ordner zurueck, wenn die Datei kein Datum traegt', () => {
    const r = datumAusPfad('4. Aktivismus/2025-07-16 Besprechung mit Jonas/Notiz.md')
    expect(r).toEqual({ datum: '2025-07-16', segment: '2025-07-16 Besprechung mit Jonas', genauigkeit: 'tag' })
  })

  it('nimmt den taggenauen Elternordner, nicht den monatsscharfen Unterordner (W1b)', () => {
    // Genauigkeit schlaegt Naehe: ein bekannter Tag wird nicht gegen einen
    // unbekannten eingetauscht, nur weil das groebere Segment naeher liegt.
    const r = datumAusPfad('2025-07-16 Werkstatt/2025-07 Nachlese/Notiz.md')
    expect(r).toEqual({ datum: '2025-07-16', segment: '2025-07-16 Werkstatt', genauigkeit: 'tag' })
  })

  it('liefert monatsscharf, wenn nirgends ein Tag steht (W1b)', () => {
    const r = datumAusPfad('9. Wissen/2025-07 Sammlung/Aufnahme.m4a')
    expect(r).toEqual({ datum: '2025-07-01', segment: '2025-07 Sammlung', genauigkeit: 'monat' })
  })

  it('gibt null zurueck, wenn nirgends ein Datum steht — statt eines zu raten', () => {
    expect(datumAusPfad('4. Aktivismus/26.01 Klimamassnahmen/Notiz.md')).toBeNull()
  })
})

describe('dateFehlt', () => {
  it('behandelt leer, Leerzeichen, null und fehlend als fehlend', () => {
    expect(dateFehlt(undefined)).toBe(true)
    expect(dateFehlt(null)).toBe(true)
    expect(dateFehlt('')).toBe(true)
    expect(dateFehlt('   ')).toBe(true)
  })

  it('laesst einen gesetzten Wert in Ruhe', () => {
    expect(dateFehlt('2025-07-16')).toBe(false)
  })
})
