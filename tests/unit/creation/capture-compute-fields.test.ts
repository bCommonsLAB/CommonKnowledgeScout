/**
 * Tests von buildCaptureComputeFields (U6a): docType aus dem Schema-Feld,
 * Default auf detailViewType, Durchreichen von Library/Wizard/Title.
 */

import { describe, expect, it } from 'vitest'
import { buildCaptureComputeFields } from '@/lib/creation/capture-compute-fields'

describe('buildCaptureComputeFields', () => {
  it('nimmt docType aus dem hart gesetzten Schema-Feld', () => {
    const result = buildCaptureComputeFields({
      libraryId: 'lib-1',
      wizardId: 'file-transcript-de',
      detailViewType: 'session',
      fields: [{ key: 'docType', rawValue: 'transcript' }],
      fileName: 'aufnahme.mp3',
    })
    expect(result).toEqual({
      libraryId: 'lib-1',
      wizardId: 'file-transcript-de',
      docType: 'transcript',
      detailViewType: 'session',
      title: 'aufnahme.mp3',
    })
  })

  it('faellt auf detailViewType zurueck, wenn kein docType-Feld existiert', () => {
    const result = buildCaptureComputeFields({
      libraryId: 'lib-1',
      wizardId: 'w',
      detailViewType: 'book',
      fields: [{ key: 'title', rawValue: '' }],
      fileName: 'buch.pdf',
    })
    expect(result.docType).toBe('book')
  })

  it('ignoriert ein leeres docType-Feld (Default detailViewType)', () => {
    const result = buildCaptureComputeFields({
      libraryId: 'lib-1',
      wizardId: 'w',
      detailViewType: 'session',
      fields: [{ key: 'docType', rawValue: '   ' }],
      fileName: 'x.wav',
    })
    expect(result.docType).toBe('session')
  })
})
