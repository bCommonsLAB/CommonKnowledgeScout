// @vitest-environment jsdom

/**
 * Characterization Tests fuer den **Selection-Vertrag** der Dateiliste
 * (Welle 3-I, Schritt 3).
 *
 * Statt der vollstaendigen `FileList`-Komponente testen wir die beiden
 * Selection-Atoms (`selectedBatchItemsAtom`,
 * `selectedTransformationItemsAtom`), die den Bulk-Selection-State der
 * Dateiliste tragen.
 *
 * Nach dem Modul-Split (Schritt 4b, geplante Datei
 * `hooks/use-file-list-selection.ts`) muss dieser Test weiter gruen
 * bleiben — die Atoms sind der externe Vertrag.
 */

import { describe, it, expect } from 'vitest'
import { createStore } from 'jotai'
import {
  selectedBatchItemsAtom,
  selectedTransformationItemsAtom,
  getMediaType,
  type BatchTranscriptionItem,
} from '@/atoms/transcription-options'
import type { StorageItem } from '@/lib/storage/types'

function makeAudio(id: string): StorageItem {
  return {
    id,
    parentId: 'root',
    type: 'file',
    metadata: {
      name: `${id}.mp3`,
      size: 1234,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'audio/mpeg',
    },
  }
}

function makePdf(id: string): StorageItem {
  return {
    id,
    parentId: 'root',
    type: 'file',
    metadata: {
      name: `${id}.pdf`,
      size: 5678,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'application/pdf',
    },
  }
}

describe('FileList Selection-Vertrag', () => {
  it('startet mit leerer Batch-Auswahl', () => {
    const store = createStore()
    expect(store.get(selectedBatchItemsAtom)).toEqual([])
    expect(store.get(selectedTransformationItemsAtom)).toEqual([])
  })

  it('akzeptiert Audio-Items in der Batch-Auswahl mit type=audio', () => {
    const store = createStore()
    const audio = makeAudio('audio-1')
    const items: BatchTranscriptionItem[] = [
      { item: audio, type: getMediaType(audio) },
    ]
    store.set(selectedBatchItemsAtom, items)

    const result = store.get(selectedBatchItemsAtom)
    expect(result).toHaveLength(1)
    expect(result[0].item.id).toBe('audio-1')
    expect(result[0].type).toBe('audio')
  })

  it('akzeptiert PDFs in der Transformation-Auswahl mit type=document', () => {
    const store = createStore()
    const pdf = makePdf('pdf-1')
    store.set(selectedTransformationItemsAtom, [
      { item: pdf, type: getMediaType(pdf) },
    ])

    const result = store.get(selectedTransformationItemsAtom)
    expect(result).toHaveLength(1)
    expect(result[0].item.id).toBe('pdf-1')
    expect(result[0].type).toBe('document')
  })

  it('Batch- und Transformation-Auswahl sind unabhaengig', () => {
    const store = createStore()
    const audio = makeAudio('a')
    const pdf = makePdf('b')

    store.set(selectedBatchItemsAtom, [{ item: audio, type: 'audio' }])
    store.set(selectedTransformationItemsAtom, [{ item: pdf, type: 'document' }])

    expect(store.get(selectedBatchItemsAtom)).toHaveLength(1)
    expect(store.get(selectedTransformationItemsAtom)).toHaveLength(1)
    expect(store.get(selectedBatchItemsAtom)[0].item.id).toBe('a')
    expect(store.get(selectedTransformationItemsAtom)[0].item.id).toBe('b')
  })

  it('leere Auswahl resetten ist idempotent', () => {
    const store = createStore()
    store.set(selectedBatchItemsAtom, [{ item: makeAudio('a'), type: 'audio' }])
    store.set(selectedBatchItemsAtom, [])
    expect(store.get(selectedBatchItemsAtom)).toEqual([])
  })
})
