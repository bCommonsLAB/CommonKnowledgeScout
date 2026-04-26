/**
 * Char-Tests fuer `buildMongoShadowTwinItem`.
 *
 * Welle 2, Schritt 3.
 *
 * Funktion liefert ein virtuelles `StorageItem` fuer Mongo-basierte
 * Shadow-Twin-Artefakte. Tests fixieren das beobachtete Verhalten:
 * - Korrekte ID-Konstruktion via `buildMongoShadowTwinId`
 * - Korrekte Namens-Bildung via `buildArtifactName`
 * - `isTwin: true` als Marker
 * - `mimeType: 'text/markdown'` (Mongo-Artefakte sind immer Markdown)
 */

import { describe, expect, it } from 'vitest'
import { buildMongoShadowTwinItem } from '@/lib/shadow-twin/mongo-shadow-twin-item'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

describe('buildMongoShadowTwinItem', () => {
  it('liefert ein virtuelles StorageItem mit Mongo-Shadow-Twin-ID', () => {
    const item = buildMongoShadowTwinItem({
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'document.pdf',
      parentId: 'parent-1',
      kind: 'transcript',
      targetLanguage: 'de',
    })

    expect(isMongoShadowTwinId(item.id)).toBe(true)
    expect(item.parentId).toBe('parent-1')
    expect(item.type).toBe('file')
    expect(item.metadata.isTwin).toBe(true)
    expect(item.metadata.mimeType).toBe('text/markdown')
  })

  it('encodiert ID-Komponenten so, dass parseMongoShadowTwinId roundtrip-faehig ist', () => {
    const item = buildMongoShadowTwinItem({
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'parent-1',
      kind: 'transformation',
      targetLanguage: 'en',
      templateName: 'pdfanalyse',
    })

    const parsed = parseMongoShadowTwinId(item.id)
    expect(parsed).toEqual({
      libraryId: 'lib-1',
      sourceId: 'src-1',
      kind: 'transformation',
      targetLanguage: 'en',
      templateName: 'pdfanalyse',
    })
  })

  it('uebernimmt markdownLength als size, default 0', () => {
    const a = buildMongoShadowTwinItem({
      libraryId: 'lib',
      sourceId: 'src',
      sourceName: 'x.pdf',
      parentId: 'p',
      kind: 'transcript',
      targetLanguage: 'de',
      markdownLength: 1234,
    })
    expect(a.metadata.size).toBe(1234)

    const b = buildMongoShadowTwinItem({
      libraryId: 'lib',
      sourceId: 'src',
      sourceName: 'x.pdf',
      parentId: 'p',
      kind: 'transcript',
      targetLanguage: 'de',
    })
    expect(b.metadata.size).toBe(0)
  })

  it('parsed updatedAt als ISO-String in Date', () => {
    const iso = '2026-04-27T08:00:00.000Z'
    const item = buildMongoShadowTwinItem({
      libraryId: 'lib',
      sourceId: 'src',
      sourceName: 'x.pdf',
      parentId: 'p',
      kind: 'transcript',
      targetLanguage: 'de',
      updatedAt: iso,
    })

    expect(item.metadata.modifiedAt).toBeInstanceOf(Date)
    expect(item.metadata.modifiedAt.toISOString()).toBe(iso)
  })

  it('liefert eine "fresh"-Date, wenn updatedAt fehlt', () => {
    const before = Date.now()
    const item = buildMongoShadowTwinItem({
      libraryId: 'lib',
      sourceId: 'src',
      sourceName: 'x.pdf',
      parentId: 'p',
      kind: 'transcript',
      targetLanguage: 'de',
    })
    const after = Date.now()

    expect(item.metadata.modifiedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(item.metadata.modifiedAt.getTime()).toBeLessThanOrEqual(after)
  })

  it('Vertrag §1: templateName ist Bestandteil der ID fuer transformation', () => {
    const a = buildMongoShadowTwinItem({
      libraryId: 'lib', sourceId: 'src', sourceName: 'x.pdf', parentId: 'p',
      kind: 'transformation', targetLanguage: 'de', templateName: 't1',
    })
    const b = buildMongoShadowTwinItem({
      libraryId: 'lib', sourceId: 'src', sourceName: 'x.pdf', parentId: 'p',
      kind: 'transformation', targetLanguage: 'de', templateName: 't2',
    })
    // Verschiedene Templates -> verschiedene IDs.
    expect(a.id).not.toBe(b.id)
  })
})
