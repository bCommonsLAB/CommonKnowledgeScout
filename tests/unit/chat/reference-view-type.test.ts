import { describe, it, expect } from 'vitest'
import {
  attachTitleToReferences,
  buildTitleByFileId,
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

describe('buildTitleByFileId / attachTitleToReferences (D12k)', () => {
  const refs: ChatResponse['references'] = [
    { number: 1, fileId: 'f1', fileName: 'page-017.de.md', description: 'x' },
    { number: 2, fileId: 'f2', description: 'y' },
  ]

  it('nimmt den getrimmten Titel aus docMetaJson, leere/fehlende -> undefined', () => {
    const map = buildTitleByFileId(
      new Map([
        ['f1', { docMetaJson: { title: '  Bahnlinie Meran-Bozen ' } }],
        ['f2', { docMetaJson: { title: '   ' } }],
        ['f3', {}],
      ]),
    )
    expect(map.get('f1')).toBe('Bahnlinie Meran-Bozen')
    expect(map.get('f2')).toBeUndefined()
    expect(map.get('f3')).toBeUndefined()
  })

  it('haengt den Titel an und laesst Referenzen ohne Titel und das Original unveraendert', () => {
    const out = attachTitleToReferences(refs, new Map([['f1', 'Bahnlinie Meran-Bozen']]))
    expect(out[0]).toMatchObject({ fileId: 'f1', fileName: 'page-017.de.md', title: 'Bahnlinie Meran-Bozen' })
    expect(out[1]).not.toHaveProperty('title')
    expect(refs[0]).not.toHaveProperty('title')
  })
})
