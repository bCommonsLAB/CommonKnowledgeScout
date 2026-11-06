/**
 * Programm-Kopf der Session-Ansicht (Owner 06.11.2026): Raum, Dauer und
 * Original-Link kommen aus dem Meta-Dokument — auch aus den Feldnamen der
 * Konferenz-Vorlage (`duration_min`, `source_url`).
 */
import { describe, it, expect } from 'vitest'
import { mapToSessionDetail } from '@/lib/mappers/doc-meta-mappers'
import { formatProgrammeDate, formatProgrammeTime } from '@/components/library/session-programme-bar'

describe('mapToSessionDetail — Programmfelder', () => {
  it('liest room, duration_min und source_url als Fallback', () => {
    const d = mapToSessionDetail({ docMetaJson: { title: 'T', room: 'Seminar 3', duration_min: 15, source_url: 'https://example.org/talk/' } })
    expect(d.room).toBe('Seminar 3')
    expect(d.duration).toBe(15)
    expect(d.url).toBe('https://example.org/talk/')
  })

  it('duration und url gehen vor duration_min und source_url', () => {
    const d = mapToSessionDetail({ docMetaJson: { title: 'T', duration: '30', duration_min: 15, url: 'https://a/', source_url: 'https://b/' } })
    expect(d.duration).toBe('30')
    expect(d.url).toBe('https://a/')
  })

  it('fehlende Felder bleiben undefined', () => {
    const d = mapToSessionDetail({ docMetaJson: { title: 'T' } })
    expect(d.room).toBeUndefined()
    expect(d.duration).toBeUndefined()
    expect(d.url).toBeUndefined()
  })
})

describe('Programm-Kopf: Datum und Uhrzeit', () => {
  it('formatiert ein ISO-Datum mit Wochentag in der Sprache der Oberflaeche', () => {
    expect(formatProgrammeDate('2026-11-13', 'de')).toMatch(/^Fr\.?,? 13\.11\.2026$/)
    expect(formatProgrammeDate('2026-11-14', 'en')).toMatch(/^Sat, 11\/14\/2026$/)
  })

  it('laesst ein Nicht-ISO-Datum unveraendert und leer leer', () => {
    expect(formatProgrammeDate('Friday', 'de')).toBe('Friday')
    expect(formatProgrammeDate(undefined, 'de')).toBeUndefined()
    expect(formatProgrammeDate('  ', 'de')).toBeUndefined()
  })

  it('setzt Start, Ende und Dauer zusammen und laesst Fehlendes weg', () => {
    expect(formatProgrammeTime('10:30', '11:00', 30, 'min')).toBe('10:30 – 11:00 · 30 min')
    expect(formatProgrammeTime('10:30', undefined, 30, 'min')).toBe('10:30 · 30 min')
    expect(formatProgrammeTime('10:30', undefined, undefined, 'min')).toBe('10:30')
    expect(formatProgrammeTime(undefined, undefined, '15', 'min')).toBe('15 min')
    expect(formatProgrammeTime(undefined, undefined, undefined, 'min')).toBeUndefined()
  })
})
