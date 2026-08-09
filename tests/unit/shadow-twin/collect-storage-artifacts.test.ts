/**
 * @fileoverview Unit-Tests fuer collectStorageArtifactsForSource (Welle 5a):
 * Transkript-Guard-Fix ({base}.md mit targetLanguage null), Selbst-Ausschluss,
 * kanonischer Transkript-Vorrang, Schutz vor page_NNN-Zwischendaten.
 */

import { describe, it, expect } from 'vitest'
import { collectStorageArtifactsForSource } from '@/lib/shadow-twin/collect-storage-artifacts'
import type { StorageItem } from '@/lib/storage/types'

function file(id: string, name: string): StorageItem {
  return { id, type: 'file', parentId: 'parent', metadata: { name } } as unknown as StorageItem
}

const source = file('src-1', 'doc.pdf')

describe('collectStorageArtifactsForSource', () => {
  it('adoptiert das KANONISCHE sprach-neutrale Transkript {base}.md (Guard-Bug-Fix)', () => {
    const artifacts = collectStorageArtifactsForSource({
      source,
      parentItems: [source],
      shadowTwinFolderItems: [file('t-1', 'doc.md')],
    })
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].key).toEqual({ sourceId: 'src-1', kind: 'transcript', targetLanguage: '', templateName: undefined })
  })

  it('adoptiert Transformationen und Legacy-Transkripte wie bisher', () => {
    const artifacts = collectStorageArtifactsForSource({
      source,
      parentItems: [source],
      shadowTwinFolderItems: [file('t-1', 'doc.de.md'), file('t-2', 'doc.pdfanalyse.de.md')],
    })
    const kinds = artifacts.map((a) => [a.key.kind, a.key.targetLanguage, a.key.templateName])
    expect(kinds).toContainEqual(['transcript', 'de', undefined])
    expect(kinds).toContainEqual(['transformation', 'de', 'pdfanalyse'])
  })

  it('kanonisches Transkript verdraengt Legacy-Varianten (keine Reihenfolge-Lotterie)', () => {
    const artifacts = collectStorageArtifactsForSource({
      source,
      parentItems: [],
      shadowTwinFolderItems: [file('t-1', 'doc.de.md'), file('t-2', 'doc.md'), file('t-3', 'doc.alpha.en.md')],
    })
    const transcripts = artifacts.filter((a) => a.key.kind === 'transcript')
    expect(transcripts).toHaveLength(1)
    expect(transcripts[0].item.metadata.name).toBe('doc.md')
    expect(artifacts.some((a) => a.key.kind === 'transformation')).toBe(true)
  })

  it('die Quelldatei selbst ist NIE ihr eigenes Artefakt (Markdown-Quelle)', () => {
    const mdSource = file('src-md', 'notes.md')
    const artifacts = collectStorageArtifactsForSource({
      source: mdSource,
      parentItems: [mdSource],
      shadowTwinFolderItems: [],
    })
    expect(artifacts).toEqual([])
  })

  it('ignoriert page_NNN-Zwischendaten und fremde Quellen (Prefix-Regel)', () => {
    const artifacts = collectStorageArtifactsForSource({
      source,
      parentItems: [file('x-1', 'other.de.md')],
      shadowTwinFolderItems: [file('p-1', 'page_001.en.md'), file('p-2', 'page_001.jpeg')],
    })
    expect(artifacts).toEqual([])
  })

  it('ueberspringt raw-Artefakte und unbekannte Dateien', () => {
    const artifacts = collectStorageArtifactsForSource({
      source,
      parentItems: [],
      shadowTwinFolderItems: [file('r-1', 'doc.raw.html'), file('u-1', 'doc.jpg')],
    })
    expect(artifacts).toEqual([])
  })

  it('dedupliziert Dateien, die in Twin-Ordner UND Parent-Liste auftauchen', () => {
    const twin = file('t-1', 'doc.alpha.de.md')
    const artifacts = collectStorageArtifactsForSource({
      source,
      parentItems: [twin],
      shadowTwinFolderItems: [twin],
    })
    expect(artifacts).toHaveLength(1)
  })
})
