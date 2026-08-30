import { describe, expect, it } from 'vitest'
import {
  docMatchesNavigationSlug,
  getEffectiveDocumentNavigationSlug,
  NAVIGATION_SLUG_MAX_LEN,
} from '@/utils/document-slug-navigation'
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug-persist'
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

  it('nimmt den Dateinamen vor dem Titel — gleiche Reihenfolge wie beim Persistieren', () => {
    const doc: DocCardMeta = {
      id: 'f6-meta',
      fileId: 'f6',
      fileName: 'IMG_20240517_121314.jpg',
      title: 'Wasserkraftwerk Mühlbach',
    }
    const slug = getEffectiveDocumentNavigationSlug(doc)!
    expect(slug.startsWith('img-20240517-121314-')).toBe(true)
  })

  it('Basis stimmt mit dem Persist-Slug überein (nur Suffix kommt dazu)', () => {
    // Kandidaten wie in ingestion-service: fileName -> source_file -> title
    const cases: Array<{ fileName: string; title: string }> = [
      { fileName: 'aktionsbericht.de.md', title: 'Aktionsbericht' },
      { fileName: 'Faunistik der Gallwespen von Südtirol.de.md', title: 'Faunistik der Gallwespen von Südtirol' },
      { fileName: '2025-jahresbericht.md', title: '2025 Jahresbericht' },
      { fileName: 'sammel-transkript_2026-03-22T21-14-50_de.off-aktionsbericht-de.de.md', title: '' },
    ]
    for (const c of cases) {
      const doc: DocCardMeta = { id: `${c.fileName}-meta`, fileId: c.fileName, ...c }
      const persistSlug = buildDocumentSlugFallback(c.fileName, undefined, c.title)
      const navSlug = getEffectiveDocumentNavigationSlug(doc)!
      expect(navSlug.startsWith(`${persistSlug}-`)).toBe(true)
    }
  })

  it('begrenzt die Basis auf NAVIGATION_SLUG_MAX_LEN', () => {
    const fileName = `${'a'.repeat(200)}.md`
    const doc: DocCardMeta = { id: 'lang-meta', fileId: 'lang', fileName }
    const slug = getEffectiveDocumentNavigationSlug(doc)!
    const [base] = slug.split(/-(?=[a-z0-9]{1,8}$)/)
    expect(base.length).toBe(NAVIGATION_SLUG_MAX_LEN)
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

  it('hält einen geteilten Link am Leben, wenn meta.slug später nachgeschrieben wird', () => {
    const ohneSlug: DocCardMeta = {
      id: 'shared-meta',
      fileId: 'shared',
      fileName: 'Aktionsbericht Wasser.de.md',
      title: 'Aktionsbericht Wasser',
    }
    // Link wird geteilt, solange das Dokument noch keinen meta.slug hat
    const geteilterLink = getEffectiveDocumentNavigationSlug(ohneSlug)!

    // Ingest schreibt meta.slug nach (buildDocumentSlugFallback, ohne Suffix)
    const mitSlug: DocCardMeta = {
      ...ohneSlug,
      slug: buildDocumentSlugFallback(ohneSlug.fileName, undefined, ohneSlug.title),
    }

    expect(docMatchesNavigationSlug(mitSlug, geteilterLink)).toBe(true)
    expect(docMatchesNavigationSlug(mitSlug, mitSlug.slug!)).toBe(true)
  })

  it('matcht auch die alte, titelzuerst gebildete Slug-Form', () => {
    const doc: DocCardMeta = {
      id: 'legacy-meta',
      fileId: 'legacy',
      fileName: 'IMG_20240517_121314.jpg',
      title: 'Wasserkraftwerk Mühlbach',
    }
    const neu = getEffectiveDocumentNavigationSlug(doc)!
    const suffix = neu.slice(neu.lastIndexOf('-') + 1)
    const altTitelZuerst = `${buildDocumentSlugFallback(doc.title, doc.shortTitle, doc.fileName)}-${suffix}`

    expect(altTitelZuerst).not.toBe(neu)
    expect(docMatchesNavigationSlug(doc, altTitelZuerst)).toBe(true)
    expect(docMatchesNavigationSlug(doc, neu)).toBe(true)
  })

  it('matcht nicht ohne fileId/id', () => {
    const doc: DocCardMeta = { id: '', fileName: 'report.pdf' }
    expect(docMatchesNavigationSlug(doc, 'report-abc')).toBe(false)
  })
})
