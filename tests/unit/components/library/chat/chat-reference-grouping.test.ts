import { describe, it, expect } from 'vitest'
import { groupReferencesByFileId } from '@/components/library/chat/chat-reference-list/helpers'
import type { ChatResponse } from '@/types/chat-response'

describe('groupReferencesByFileId — detailViewType (A4)', () => {
  it('uebernimmt den detailViewType je Dokument', () => {
    const refs: ChatResponse['references'] = [
      { number: 1, fileId: 'f1', description: 'Markdown body', detailViewType: 'climateAction' },
      { number: 2, fileId: 'f1', description: 'Slide page 2' },
      { number: 3, fileId: 'f2', description: 'Chapter 1' },
    ]
    const grouped = groupReferencesByFileId(refs)
    expect(grouped.find((g) => g.fileId === 'f1')?.detailViewType).toBe('climateAction')
    expect(grouped.find((g) => g.fileId === 'f2')?.detailViewType).toBeUndefined()
  })

  it('uebernimmt den Typ auch, wenn erst eine spaetere Referenz ihn traegt', () => {
    const refs: ChatResponse['references'] = [
      { number: 1, fileId: 'f1', description: 'Slide page 2' },
      { number: 2, fileId: 'f1', description: 'Markdown body', detailViewType: 'book' },
    ]
    expect(groupReferencesByFileId(refs)[0].detailViewType).toBe('book')
  })
})
