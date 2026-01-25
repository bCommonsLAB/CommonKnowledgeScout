import { describe, expect, it } from 'vitest'
import { buildMongoShadowTwinId, isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

describe('mongo-shadow-twin-id', () => {
  it('buildet und parst IDs deterministisch', () => {
    const id = buildMongoShadowTwinId({
      libraryId: 'lib-1',
      sourceId: 'file/123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'klima detail',
    })

    expect(isMongoShadowTwinId(id)).toBe(true)

    const parsed = parseMongoShadowTwinId(id)
    expect(parsed).toEqual({
      libraryId: 'lib-1',
      sourceId: 'file/123',
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: 'klima detail',
    })
  })

  it('erkennt fremde IDs nicht', () => {
    expect(isMongoShadowTwinId('file-123')).toBe(false)
    expect(parseMongoShadowTwinId('file-123')).toBeNull()
  })
})
