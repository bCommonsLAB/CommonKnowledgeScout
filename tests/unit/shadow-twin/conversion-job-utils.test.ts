import { describe, expect, it } from 'vitest'
import { buildConversionUpdate, type VectorMetaDocForConversion } from '@/lib/shadow-twin/conversion-job-utils'

function buildDoc(overrides: Partial<VectorMetaDocForConversion>): VectorMetaDocForConversion {
  return {
    _id: 'doc1',
    kind: 'meta',
    libraryId: 'lib1',
    user: 'u@example.com',
    fileId: 'SOURCE_FILE_ID',
    fileName: 'MeineDatei.de.md',
    docMetaJson: {},
    ...overrides,
  }
}

describe('buildConversionUpdate', () => {
  it('backfills sourceFileId/artifactKind/targetLanguage for transcript', () => {
    const doc = buildDoc({
      docMetaJson: {
        // kein template => transcript
      },
    })
    const upd = buildConversionUpdate(doc)
    expect(upd?.$set['docMetaJson.sourceFileId']).toBe('SOURCE_FILE_ID')
    expect(upd?.$set['docMetaJson.artifactKind']).toBe('transcript')
    expect(upd?.$set['docMetaJson.targetLanguage']).toBe('de')
  })

  it('detects transformation via template and sets templateName', () => {
    const doc = buildDoc({
      fileName: 'MeineDatei.Besprechung.de.md',
      docMetaJson: {
        template: 'Besprechung',
      },
    })
    const upd = buildConversionUpdate(doc)
    expect(upd?.$set['docMetaJson.artifactKind']).toBe('transformation')
    expect(upd?.$set['docMetaJson.templateName']).toBe('Besprechung')
    expect(upd?.$set['docMetaJson.targetLanguage']).toBe('de')
  })

  it('writes targetLanguage even if legacy meta has only language', () => {
    const doc = buildDoc({
      docMetaJson: {
        language: 'de',
      },
    })
    const upd = buildConversionUpdate(doc)
    expect(upd?.$set['docMetaJson.targetLanguage']).toBe('de')
  })

  it('does not overwrite existing values', () => {
    const doc = buildDoc({
      docMetaJson: {
        sourceFileId: 'EXISTING_SOURCE',
        artifactKind: 'transformation',
        targetLanguage: 'en',
        templateName: 'Foo',
      },
    })
    const upd = buildConversionUpdate(doc)
    expect(upd).toBeNull()
  })
})


