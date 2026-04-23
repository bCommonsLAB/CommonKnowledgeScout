/**
 * @fileoverview Integrationstest (in-memory): OCR -> Mongo-Doc -> Render-Loop
 *
 * Simuliert den End-to-End-Loop fuer die deterministische Media-Speicher-Strategie:
 * 1. Ein Mongo-Shadow-Twin-Dokument enthaelt ein Markdown mit RELATIVEN Bildpfaden
 *    (so wie es Bestandsdaten vor Phase 3 typischerweise tun) plus binaryFragments mit
 *    absoluten Azure-URLs.
 * 2. Wir lassen die Migrations-Funktion `migrateDocumentImages` darueberlaufen.
 * 3. Erwartung:
 *    - Markdown enthaelt nur noch absolute https-URLs.
 *    - Replacements > 0, unresolved == 0.
 *    - Beim Rendern muesste daher KEIN streaming-url mehr aufgerufen werden.
 *
 * Damit ist der gesamte Phase-3-/Phase-6-Pfad in einem Test gegen Regressionen abgesichert.
 */

import { describe, it, expect } from 'vitest'
import { migrateDocumentImages } from '@/lib/shadow-twin/migrate-document-images'

const azureUrlImg0 = 'https://blob.example/cnt/lib/books/src/aabbccdd11223344.jpeg'
const azureUrlImg1 = 'https://blob.example/cnt/lib/books/src/deadbeef.png'

const baseDoc = () => ({
  libraryId: 'lib-123',
  sourceId: 'src-abc',
  sourceName: 'Bericht.pdf',
  parentId: 'folder-1',
  userEmail: 'me@example.org',
  binaryFragments: [
    {
      name: 'img-0.jpeg',
      hash: 'aabbccdd11223344',
      url: azureUrlImg0,
      kind: 'image',
      mimeType: 'image/jpeg',
    },
    {
      name: 'img-1.png',
      hash: 'deadbeef',
      url: azureUrlImg1,
      kind: 'image',
      mimeType: 'image/png',
    },
  ],
  artifacts: {
    transcript: {
      de: {
        markdown:
          'Erster Absatz.\n\n![](_Bericht.pdf/img-0.jpeg)\n\nZweiter Absatz.\n\n<img src="img-1.png" alt="logo">',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    },
    transformation: {
      'reise-bericht': {
        de: {
          markdown: 'Transformation:\n\n![](img-0.jpeg)',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      },
    },
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('OCR -> Mongo -> Render Loop (deterministische Media-Strategie)', () => {
  it('migriert sowohl transcript- als auch transformation-Markdown auf absolute Azure-URLs', () => {
    const doc = baseDoc()
    const { changed, newDoc, stats } = migrateDocumentImages(doc)

    expect(changed).toBe(true)
    expect(stats.totalReplacements).toBe(3)
    expect(stats.unresolved).toEqual([])

    const newArtifacts = (newDoc as { artifacts: Record<string, Record<string, Record<string, { markdown: string }>>> }).artifacts
    const transcriptDe = newArtifacts.transcript.de.markdown
    const transformationDe = newArtifacts.transformation['reise-bericht'].de.markdown

    expect(transcriptDe).toContain(azureUrlImg0)
    expect(transcriptDe).toContain(azureUrlImg1)
    expect(transcriptDe).not.toMatch(/!\[\]\(_Bericht\.pdf\/img-0\.jpeg\)/)
    expect(transcriptDe).not.toMatch(/<img src="img-1\.png"/)

    expect(transformationDe).toContain(azureUrlImg0)
  })

  it('Render-Form: alle Bildpfade im Output starten mit https:// (Browser-Direktladung)', () => {
    const doc = baseDoc()
    const { newDoc } = migrateDocumentImages(doc)
    const transcriptDe = (newDoc as { artifacts: { transcript: { de: { markdown: string } } } }).artifacts.transcript.de.markdown

    const mdImageRefs = Array.from(transcriptDe.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)).map((m) => m[1])
    const htmlImageRefs = Array.from(transcriptDe.matchAll(/<img[^>]+src=["']([^"']+)["']/g)).map((m) => m[1])

    for (const url of [...mdImageRefs, ...htmlImageRefs]) {
      expect(url.startsWith('https://')).toBe(true)
    }
  })

  it('idempotent: zweiter Lauf veraendert nichts mehr', () => {
    const first = migrateDocumentImages(baseDoc())
    const second = migrateDocumentImages(first.newDoc)
    expect(second.changed).toBe(false)
    expect(second.stats.totalReplacements).toBe(0)
  })

  it('liefert unresolved fuer Bilder, die nicht in binaryFragments liegen', () => {
    const doc = baseDoc()
    ;(doc.artifacts as { transcript: { de: { markdown: string } } }).transcript.de.markdown += '\n\n![](unbekannt.jpeg)'
    const { stats } = migrateDocumentImages(doc)
    expect(stats.unresolved).toContain('unbekannt.jpeg')
  })

  it('aendert nichts, wenn das Markdown bereits absolute URLs enthaelt', () => {
    const doc = baseDoc()
    ;(doc.artifacts as { transcript: { de: { markdown: string } } }).transcript.de.markdown =
      `Bereits gefroren: ![](${azureUrlImg0})`
    ;(doc.artifacts as { transformation: Record<string, Record<string, { markdown: string }>> }).transformation[
      'reise-bericht'
    ].de.markdown = `Auch gefroren: ![](${azureUrlImg0})`
    const { changed, stats } = migrateDocumentImages(doc)
    expect(changed).toBe(false)
    expect(stats.totalReplacements).toBe(0)
    expect(stats.unresolved).toEqual([])
  })
})
