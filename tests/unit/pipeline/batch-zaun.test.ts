/**
 * Welle C — der gemeinsame Zaun fuer Batch-Dialog und Bruecke: Twin-Ordner
 * (_…) und test/ bleiben aussen vor, alles andere nicht.
 */
import { describe, it, expect } from 'vitest'
import { istVomBatchAusgeschlossen } from '@/lib/pipeline/batch-zaun'

describe('istVomBatchAusgeschlossen', () => {
  it('schliesst Twin-Ordner und test-Ordner aus', () => {
    expect(istVomBatchAusgeschlossen('_Massnahme 12')).toBe(true)
    expect(istVomBatchAusgeschlossen('test')).toBe(true)
    expect(istVomBatchAusgeschlossen('Test')).toBe(true)
    expect(istVomBatchAusgeschlossen('tests')).toBe(true)
  })

  it('laesst normale Ordner durch — auch mit test im Namen', () => {
    expect(istVomBatchAusgeschlossen('Massnahmen')).toBe(false)
    expect(istVomBatchAusgeschlossen('Testimonials')).toBe(false)
    expect(istVomBatchAusgeschlossen('')).toBe(false)
  })
})
