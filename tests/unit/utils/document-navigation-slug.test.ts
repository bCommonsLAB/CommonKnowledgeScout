import { describe, expect, it } from 'vitest'
import {
  docMatchesNavigationSlug,
  getEffectiveDocumentNavigationSlug,
} from '@/utils/document-slug'
import type { DocCardMeta } from '@/lib/gallery/types'

describe('getEffectiveDocumentNavigationSlug', () => {
  it('verwendet persistierten slug unverändert', () => {
    const doc: DocCardMeta = {
      id: 'x-meta',
      fileId: 'x',
      slug: 'mein-titel',
      title: 'Anders',
    }
    expect(getEffectiveDocumentNavigationSlug(doc)).toBe('mein-titel')
  })

  it('leitet aus Dateinamen ab und hängt stabilen Suffix an', () => {
    const doc: DocCardMeta = {
      id: 'abc-meta',
      fileId: 'abc',
      title: '',
      shortTitle: '',
      fileName: 'Hellrigl_2008_FaunistikDerGallwespenVonSüdtirol.de.md',
    }
    const slug = getEffectiveDocumentNavigationSlug(doc)
    // NFKD + Nicht-Buchstaben: Umlaute können als Bindestrich-Segment erscheinen (z. B. "su-dtirol")
    expect(slug?.startsWith('hellrigl-2008-faunistikdergallwespenvon')).toBe(true)
    // Letztes Segment = stabiler Hash aus fileId
    expect(slug).toMatch(/-[a-z0-9]{4,8}$/)
  })

  it('gibt null ohne fileId/id zurück', () => {
    const doc: DocCardMeta = { id: '', title: 'Titel' }
    expect(getEffectiveDocumentNavigationSlug(doc)).toBeNull()
  })
})

describe('docMatchesNavigationSlug', () => {
  it('matcht synthetischen Slug', () => {
    const doc: DocCardMeta = {
      id: 'fid1-meta',
      fileId: 'fid1',
      fileName: 'report.pdf',
    }
    const slug = getEffectiveDocumentNavigationSlug(doc)!
    expect(docMatchesNavigationSlug(doc, slug)).toBe(true)
    expect(docMatchesNavigationSlug(doc, 'falsch')).toBe(false)
  })
})
