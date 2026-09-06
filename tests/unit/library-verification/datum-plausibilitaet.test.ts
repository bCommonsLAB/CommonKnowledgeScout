/**
 * W5 (Wunschliste 4) — Plausibilitaetspruefung fuer `date`.
 *
 * Belegt an `26.01 Klimamassnahmen Suedtirol/klimamassnahme-detail1-de.docx`:
 * Das verifizierte `date` (2026-08-22) ist identisch mit dem `generated_at`
 * der Transformation — das Verarbeitungsdatum steht als Inhaltsdatum, und
 * zwar mit `verified_by: human`, also als Beleg ausgewiesen.
 */
import { describe, expect, it } from 'vitest'
import { alsKalendertag, pruefeDatumPlausibilitaet } from '@/lib/library-verification/datum-plausibilitaet'

const JETZT = new Date('2026-09-06T18:00:00Z')

describe('alsKalendertag', () => {
  it('liest Zeichenketten und Date-Objekte', () => {
    expect(alsKalendertag('2026-08-22')).toBe('2026-08-22')
    expect(alsKalendertag('2026-08-22T10:00:00Z')).toBe('2026-08-22')
    expect(alsKalendertag(new Date('2026-08-22T10:00:00Z'))).toBe('2026-08-22')
  })

  it('gibt null zurueck, wo kein Datum steht — das ist Sache der Facetten-Pruefung', () => {
    expect(alsKalendertag(undefined)).toBeNull()
    expect(alsKalendertag('')).toBeNull()
    expect(alsKalendertag('irgendwann')).toBeNull()
    expect(alsKalendertag('2026-02-30')).toBeNull()
  })
})

describe('pruefeDatumPlausibilitaet', () => {
  it('meldet ein Datum in der Zukunft', () => {
    const issues = pruefeDatumPlausibilitaet({ date: '2026-10-01' }, JETZT)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('implausible-date')
    expect(issues[0].field).toBe('date')
  })

  it('meldet das Verarbeitungsdatum, das als Inhaltsdatum durchgeht (A6)', () => {
    const issues = pruefeDatumPlausibilitaet(
      { date: '2026-08-22', generated_at: '2026-08-22', verified_by: 'human' },
      JETZT,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('Verarbeitung')
  })

  it('schweigt, wenn das Feld seine Herkunft nennt — dann ist die Gleichheit Zufall', () => {
    const issues = pruefeDatumPlausibilitaet(
      { date: '2026-08-22', generated_at: '2026-08-22', date_quelle: 'pfad' },
      JETZT,
    )
    expect(issues).toEqual([])
  })

  it('laesst ein gewoehnliches Datum in Ruhe', () => {
    expect(pruefeDatumPlausibilitaet({ date: '2025-07-16', generated_at: '2026-08-22' }, JETZT)).toEqual([])
  })

  it('prueft nichts, wo kein lesbares Datum steht (das meldet die Feld-Pruefung)', () => {
    expect(pruefeDatumPlausibilitaet({}, JETZT)).toEqual([])
    expect(pruefeDatumPlausibilitaet({ date: '' }, JETZT)).toEqual([])
  })

  it('meldet beides, wenn beides zutrifft', () => {
    // Kaputte Uhr beim Erzeugen: Verarbeitungs- und Inhaltsdatum in der Zukunft.
    const issues = pruefeDatumPlausibilitaet({ date: '2026-10-01', generated_at: '2026-10-01' }, JETZT)
    expect(issues).toHaveLength(2)
  })
})
