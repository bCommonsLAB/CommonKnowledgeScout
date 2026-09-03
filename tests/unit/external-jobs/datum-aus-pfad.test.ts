/**
 * Welle W10 — `date` aus dem Ablagepfad.
 *
 * Beleg: rund 360 von 1.440 Befunden bibliotheksweit sind fehlende
 * `date`-Felder, und in fast allen Faellen steht das Datum im Ordnernamen.
 *
 * Die Gegenprobe ist wichtiger als der Normalfall: Die Vorhabensordner dieses
 * Archivs heissen `26.01`, `24.09`, `23.12` — als Datum gelesen waere das ein
 * Feld voller erfundener Termine.
 */
import { describe, expect, it } from 'vitest'
import { dateFehlt, datumAusPfad, datumAusSegment } from '@/lib/external-jobs/datum-aus-pfad'

describe('datumAusSegment', () => {
  it('liest das ISO-Datum aus einem Ordnernamen', () => {
    expect(datumAusSegment('2025-07-16 Besprechung mit Jonas')).toBe('2025-07-16')
    expect(datumAusSegment('2025_07_16 Notiz')).toBe('2025-07-16')
    expect(datumAusSegment('2025.07.16')).toBe('2025-07-16')
  })

  it('liest die deutsche Form mit vierstelligem Jahr', () => {
    expect(datumAusSegment('Protokoll 16.07.2025.md')).toBe('2025-07-16')
  })

  it('liest KEINE Vorhabensnummer als Datum', () => {
    // Genau hier scheitert eine naive Fassung: 24.09 waere der 24. September.
    expect(datumAusSegment('26.01 Klimamassnahmen Suedtirol')).toBeNull()
    expect(datumAusSegment('24.09')).toBeNull()
    expect(datumAusSegment('23.12 Jahresabschluss')).toBeNull()
  })

  it('liest keine blanke Ziffernfolge — die ist im Zweifel eine Nummer', () => {
    expect(datumAusSegment('20250716')).toBeNull()
    expect(datumAusSegment('Rechnung 20250716123')).toBeNull()
  })

  it('lehnt Tage ab, die es nicht gibt', () => {
    expect(datumAusSegment('2025-02-30 Termin')).toBeNull()
    expect(datumAusSegment('2025-13-01 Termin')).toBeNull()
  })

  it('lehnt unplausible Jahre ab', () => {
    expect(datumAusSegment('1899-07-16')).toBeNull()
    expect(datumAusSegment('2525-07-16')).toBeNull()
  })
})

describe('datumAusPfad', () => {
  it('nimmt das spezifischste Segment — der Dateiname schlaegt den Ordner', () => {
    const r = datumAusPfad('4. Aktivismus/2025-01-02 Auftakt/2025-07-16 Protokoll.md')
    expect(r).toEqual({ datum: '2025-07-16', segment: '2025-07-16 Protokoll.md' })
  })

  it('faellt auf den Ordner zurueck, wenn die Datei kein Datum traegt', () => {
    const r = datumAusPfad('4. Aktivismus/2025-07-16 Besprechung mit Jonas/Notiz.md')
    expect(r).toEqual({ datum: '2025-07-16', segment: '2025-07-16 Besprechung mit Jonas' })
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
