/**
 * Befund 05.11.2026: der Draft-Ausschluss `fileId: { $nin }` landete als `$eq`
 * im Vector-Search-Filter — Gaeste einer Library mit Entwuerfen bekamen keine
 * Antwort. Die Uebersetzung muss alle Operatoren von Atlas durchlassen.
 */
import { describe, it, expect } from 'vitest'
import { istOperatorAusdruck, vectorSearchFilterAus } from '@/lib/repositories/vector-search-filter'

const token = (key: string) => key === 'tags'

describe('vectorSearchFilterAus', () => {
  it('laesst $nin (Draft-Ausschluss) und die anderen Operatoren unveraendert durch', () => {
    const { filter } = vectorSearchFilterAus(
      { fileId: { $nin: ['a', 'b'] }, year: { $gte: 2020, $lte: 2024 }, kind2: { $ne: 'x' } },
      token,
    )
    expect(filter).toEqual({ fileId: { $nin: ['a', 'b'] }, year: { $gte: 2020, $lte: 2024 }, kind2: { $ne: 'x' } })
  })

  it('direkte Werte werden $eq, Arrays werden $in, null und undefined fallen weg', () => {
    const { filter } = vectorSearchFilterAus({ libraryId: 'lib', tags: ['a'], leer: null, fehlt: undefined }, token)
    expect(filter).toEqual({ libraryId: { $eq: 'lib' }, tags: { $in: ['a'] } })
  })

  it('nennt Token-Felder mit $in oder $nin fuer die Warnung', () => {
    expect(vectorSearchFilterAus({ tags: ['a'] }, token).arrayFieldsInFilter).toEqual(['tags'])
    expect(vectorSearchFilterAus({ tags: { $nin: ['a'] } }, token).arrayFieldsInFilter).toEqual(['tags'])
    expect(vectorSearchFilterAus({ fileId: { $nin: ['a'] } }, token).arrayFieldsInFilter).toEqual([])
  })

  it('wirft bei einem unbekannten Operator statt ihn in $eq zu packen', () => {
    expect(() => vectorSearchFilterAus({ title: { $regex: 'x' } }, token)).toThrow(/\$regex wird nicht unterstuetzt/)
  })

  it('istOperatorAusdruck erkennt nur Objekte aus bekannten Operatoren', () => {
    expect(istOperatorAusdruck({ $nin: [] })).toBe(true)
    expect(istOperatorAusdruck({ $in: [], $nin: [] })).toBe(true)
    expect(istOperatorAusdruck({ $regex: 'x' })).toBe(false)
    expect(istOperatorAusdruck({ a: 1 })).toBe(false)
    expect(istOperatorAusdruck([])).toBe(false)
    expect(istOperatorAusdruck('x')).toBe(false)
  })
})
