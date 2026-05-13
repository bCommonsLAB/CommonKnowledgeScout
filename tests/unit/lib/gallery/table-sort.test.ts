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
  it('sortiert nach favoriteCount absteigend (am Doc-Feld)', () => {
    const docs: DocCardMeta[] = [
      { ...baseDoc('1', 'f1', 'Alpha'), favoriteCount: 1 },
      { ...baseDoc('2', 'f2', 'Beta'), favoriteCount: 5 },
      { ...baseDoc('3', 'f3', 'Gamma'), favoriteCount: 3 },
    ]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc')
    expect(sorted.map((d) => d.fileId)).toEqual(['f2', 'f3', 'f1'])
  })

  it('behandelt 0-counts als gueltigen Wert (nicht "leer")', () => {
    const docs: DocCardMeta[] = [
      { ...baseDoc('1', 'f1', 'A'), favoriteCount: 0 },
      { ...baseDoc('2', 'f2', 'B'), favoriteCount: 2 },
    ]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'asc')
    expect(sorted.map((d) => d.fileId)).toEqual(['f1', 'f2'])
  })

  it('nutzt ctx.favoriteCounts nur als Fallback wenn Doc-Feld fehlt', () => {
    const docs = [baseDoc('1', 'f1', 'A'), baseDoc('2', 'f2', 'B')]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc', {
      favoriteCounts: { f1: 3, f2: 1 },
    })
    expect(sorted.map((d) => d.fileId)).toEqual(['f1', 'f2'])
  })

  it('faellt auf 0 zurueck wenn weder Doc noch ctx', () => {
    const docs = [baseDoc('1', 'f1', 'A'), baseDoc('2', 'f2', 'B')]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc')
    expect(sorted.map((d) => d.fileId)).toEqual(['f1', 'f2'])
  })

  it('docs ohen fileId behalten count=0', () => {
    const noFile: DocCardMeta = {
      id: 'x',
      title: 'No File',
      fileName: 'No File',
      shortTitle: 'No File',
    }
    const docs: DocCardMeta[] = [{ ...baseDoc('1', 'f1', 'A'), favoriteCount: 3 }, noFile]
    const sorted = sortDocsByTableColumn(docs, 'favoriteCount', 'desc')
    expect(sorted[0].fileId).toBe('f1')
  })
})
