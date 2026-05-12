import { describe, expect, it } from 'vitest'
import { sortDocsByTableColumn } from '@/lib/gallery/table-sort'
import type { DocCardMeta } from '@/lib/gallery/types'

const baseDoc = (id: string, fileId: string, title: string): DocCardMeta => ({
  id,
  fileId,
  title,
  fileName: title,
  shortTitle: title,
})

describe('sortDocsByTableColumn / favoriteCount', () => {
  it('sortiert nach favoriteCount absteigend', () => {
    const docs = [baseDoc('1', 'f1', 'Alpha'), baseDoc('2', 'f2', 'Beta'), baseDoc('3', 'f3', 'Gamma')]
    const counts = { f1: 1, f2: 5, f3: 3 }
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc', { favoriteCounts: counts })
    expect(sorted.map((d) => d.fileId)).toEqual(['f2', 'f3', 'f1'])
  })

  it('behandelt 0-counts als gueltigen Wert (nicht "leer")', () => {
    const docs = [baseDoc('1', 'f1', 'A'), baseDoc('2', 'f2', 'B')]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'asc', {
      favoriteCounts: { f1: 0, f2: 2 },
    })
    expect(sorted.map((d) => d.fileId)).toEqual(['f1', 'f2'])
  })

  it('faellt auf 0 zurueck wenn keine ctx mitgegeben wird', () => {
    const docs = [baseDoc('1', 'f1', 'A'), baseDoc('2', 'f2', 'B')]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc')
    // Beides 0 -> Reihenfolge unveraendert.
    expect(sorted.map((d) => d.fileId)).toEqual(['f1', 'f2'])
  })

  it('docs ohne fileId behalten count=0', () => {
    const noFile: DocCardMeta = {
      id: 'x',
      title: 'No File',
      fileName: 'No File',
      shortTitle: 'No File',
    }
    const docs = [baseDoc('1', 'f1', 'A'), noFile]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc', {
      favoriteCounts: { f1: 3 },
    })
    expect(sorted[0].fileId).toBe('f1')
  })
})
