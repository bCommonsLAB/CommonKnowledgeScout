import { describe, it, expect } from 'vitest'
import { sortDocsByTableColumn, getDocSortValue } from '@/lib/gallery/table-sort'
import type { DocCardMeta } from '@/lib/gallery/types'

function doc(partial: Partial<DocCardMeta> & { id: string }): DocCardMeta {
  return { id: partial.id, ...partial }
}

describe('gallery table-sort', () => {
  it('sortiert nach Datum (ISO) aufsteigend innerhalb der Gruppe', () => {
    const a = doc({ id: '1', date: '2025-04-11' })
    const b = doc({ id: '2', date: '2025-01-29' })
    const c = doc({ id: '3', date: '2025-02-12' })
    const sorted = sortDocsByTableColumn([a, b, c], 'date', 'asc')
    expect(sorted.map((d) => d.id)).toEqual(['2', '3', '1'])
  })

  it('sortiert nach Titel (case-insensitive)', () => {
    const x = doc({ id: '1', shortTitle: 'Zebra' })
    const y = doc({ id: '2', shortTitle: 'alpha' })
    const sorted = sortDocsByTableColumn([x, y], 'title', 'asc')
    expect(sorted.map((d) => d.id)).toEqual(['2', '1'])
  })

  it('getDocSortValue: upsertedAt als Zeitstempel', () => {
    const d = doc({ id: '1', upsertedAt: '2026-03-22T22:34:00.000Z' })
    const v = getDocSortValue(d, 'upsertedAt')
    expect(typeof v).toBe('number')
    expect(v).toBe(Date.parse('2026-03-22T22:34:00.000Z'))
  })
})
