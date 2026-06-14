import { describe, it, expect } from 'vitest'
import {
  buildViewTypeByFileId,
  attachViewTypeToReferences,
} from '@/lib/chat/reference-view-type'
import type { ChatResponse } from '@/types/chat-response'

describe('buildViewTypeByFileId', () => {
  it('extrahiert detailViewType aus docMetaJson, leere/fehlende -> undefined', () => {
    const meta = new Map([
      ['f1', { docMetaJson: { detailViewType: 'climateAction' } }],
      ['f2', { docMetaJson: { detailViewType: '   ' } }],
      ['f3', { docMetaJson: {} }],
      ['f4', {}],
    ])
    const result = buildViewTypeByFileId(meta)
    expect(result.get('f1')).toBe('climateAction')
    expect(result.get('f2')).toBeUndefined()
    expect(result.get('f3')).toBeUndefined()
    expect(result.get('f4')).toBeUndefined()
  })
})

describe('attachViewTypeToReferences', () => {
  const refs: ChatResponse['references'] = [
    { number: 1, fileId: 'f1', description: 'x' },
    { number: 2, fileId: 'f2', description: 'y' },
  ]

  it('haengt bekannten Typ an und laesst unbekannte unveraendert', () => {
    const map = new Map<string, string | undefined>([['f1', 'book']])
    const out = attachViewTypeToReferences(refs, map)
    expect(out[0]).toMatchObject({ fileId: 'f1', detailViewType: 'book' })
    expect(out[1].detailViewType).toBeUndefined()
  })

  it('ist immutabel (Original bleibt unveraendert)', () => {
    const map = new Map<string, string | undefined>([['f1', 'book']])
    attachViewTypeToReferences(refs, map)
    expect(refs[0]).not.toHaveProperty('detailViewType')
  })
})
