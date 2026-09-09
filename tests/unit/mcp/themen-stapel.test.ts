/**
 * @fileoverview Unit-Tests: Themen-Stapel der MCP-Bruecke (Wunschliste 5, B3b).
 *
 * Vertrag wie beim Umzugs-Stapel (ST9): Adressierung ist genau eine von
 * beiden, ein Fehler bricht den Stapel NICHT ab, und jede Zeile traegt ihr
 * eigenes Ergebnis. Der Schreibweg ist injiziert und wird GEZAEHLT — ein
 * Stapel darf keinen Ordner auslassen und keinen doppelt anfassen.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  MAX_THEMEN_ORDNER,
  fuehreStapelThemenAus,
  sammleOrdnerIds,
} from '@/lib/mcp/themen-stapel'

describe('sammleOrdnerIds', () => {
  it('nimmt folderId oder folderIds, nie beides und nie keines', () => {
    expect(sammleOrdnerIds({ folderId: 'f-1' })).toEqual(['f-1'])
    expect(sammleOrdnerIds({ folderIds: ['f-1', 'f-2'] })).toEqual(['f-1', 'f-2'])
    expect(() => sammleOrdnerIds({ folderId: 'f-1', folderIds: ['f-2'] })).toThrow(/nicht beides/)
    expect(() => sammleOrdnerIds({})).toThrow(/Pflicht/)
    expect(() => sammleOrdnerIds({ folderIds: [] })).toThrow(/Pflicht/)
  })

  it('weist doppelte Ordner benannt zurueck, statt sie zweimal zu schreiben', () => {
    expect(() => sammleOrdnerIds({ folderIds: ['f-1', 'f-2', 'f-1'] })).toThrow(/Doppelte Ordner.*f-1/)
  })

  it('haelt die Stapel-Obergrenze ein', () => {
    const zuViele = Array.from({ length: MAX_THEMEN_ORDNER + 1 }, (_, i) => `f-${i}`)
    expect(() => sammleOrdnerIds({ folderIds: zuViele })).toThrow(new RegExp(`Hoechstens ${MAX_THEMEN_ORDNER}`))
    expect(sammleOrdnerIds({ folderIds: zuViele.slice(0, MAX_THEMEN_ORDNER) })).toHaveLength(MAX_THEMEN_ORDNER)
  })
})

describe('fuehreStapelThemenAus', () => {
  it('schreibt jeden Ordner genau einmal, in Reihenfolge', async () => {
    const setze = vi.fn().mockResolvedValue({ themen: ['A'], indexAngelegt: false })
    const ergebnis = await fuehreStapelThemenAus({ folderIds: ['f-1', 'f-2', 'f-3'], setze })
    expect(setze).toHaveBeenCalledTimes(3)
    expect(setze.mock.calls.map((call) => call[0])).toEqual(['f-1', 'f-2', 'f-3'])
    expect(ergebnis).toMatchObject({ gesetzt: 3, gescheitert: 0, indexAngelegt: 0 })
    expect(ergebnis.zeilen).toEqual([
      { folderId: 'f-1', themen: ['A'] },
      { folderId: 'f-2', themen: ['A'] },
      { folderId: 'f-3', themen: ['A'] },
    ])
  })

  it('ein Fehlschlag bricht den Stapel nicht ab und steht mit Code in seiner Zeile', async () => {
    const fehler = Object.assign(new Error('hat kein _INDEX.md'), { code: 'kein_index' })
    const setze = vi.fn()
      .mockResolvedValueOnce({ themen: ['A'], indexAngelegt: false })
      .mockRejectedValueOnce(fehler)
      .mockResolvedValueOnce({ themen: ['A'], indexAngelegt: true })
    const ergebnis = await fuehreStapelThemenAus({ folderIds: ['f-1', 'f-2', 'f-3'], setze })
    expect(setze).toHaveBeenCalledTimes(3)
    expect(ergebnis).toMatchObject({ gesetzt: 2, gescheitert: 1, indexAngelegt: 1 })
    expect(ergebnis.zeilen[1]).toEqual({ folderId: 'f-2', fehler: 'hat kein _INDEX.md', code: 'kein_index' })
    expect(ergebnis.zeilen[2]).toEqual({ folderId: 'f-3', themen: ['A'], indexAngelegt: true })
  })

  it('ein Fehler ohne Code verliert seine Meldung nicht', async () => {
    const setze = vi.fn().mockRejectedValue(new Error('Storage weg'))
    const ergebnis = await fuehreStapelThemenAus({ folderIds: ['f-1'], setze })
    expect(ergebnis.zeilen[0]).toEqual({ folderId: 'f-1', fehler: 'Storage weg' })
    expect(ergebnis.gescheitert).toBe(1)
  })
})
