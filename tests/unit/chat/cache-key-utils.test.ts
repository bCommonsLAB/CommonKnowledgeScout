/**
 * @fileoverview Unit Tests for Chat Cache-Key Utilities
 *
 * @description
 * Verifiziert, dass der Cache-Hash alle relevanten Parameter berücksichtigt.
 * Besonders wichtig: `llmModel` muss Teil des Hashes sein, damit Modellwechsel
 * nicht auf denselben Cache-Eintrag zeigen.
 */

import { describe, it, expect } from 'vitest'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'

describe('createCacheHash', () => {
  it('should generate the same hash for the same inputs', () => {
    const a = createCacheHash({
      libraryId: 'lib-1',
      question: 'Hello?',
      queryType: 'question',
      answerLength: 'mittel',
      targetLanguage: 'de',
      retriever: 'chunk',
      documentCount: 9,
      llmModel: 'model-a',
    })
    const b = createCacheHash({
      libraryId: 'lib-1',
      question: 'Hello?',
      queryType: 'question',
      answerLength: 'mittel',
      targetLanguage: 'de',
      retriever: 'chunk',
      documentCount: 9,
      llmModel: 'model-a',
    })

    expect(a).toBe(b)
  })

  it('should generate a different hash when only llmModel differs', () => {
    const a = createCacheHash({
      libraryId: 'lib-1',
      question: 'Hello?',
      queryType: 'question',
      answerLength: 'mittel',
      targetLanguage: 'de',
      retriever: 'chunk',
      documentCount: 9,
      llmModel: 'model-a',
    })
    const b = createCacheHash({
      libraryId: 'lib-1',
      question: 'Hello?',
      queryType: 'question',
      answerLength: 'mittel',
      targetLanguage: 'de',
      retriever: 'chunk',
      documentCount: 9,
      llmModel: 'model-b',
    })

    expect(a).not.toBe(b)
  })

  it('should normalize llmModel (case + whitespace) in the hash', () => {
    const a = createCacheHash({
      libraryId: 'lib-1',
      question: 'Hello?',
      queryType: 'question',
      answerLength: 'mittel',
      targetLanguage: 'de',
      retriever: 'chunk',
      documentCount: 9,
      llmModel: '  MODEL-A  ',
    })
    const b = createCacheHash({
      libraryId: 'lib-1',
      question: 'Hello?',
      queryType: 'question',
      answerLength: 'mittel',
      targetLanguage: 'de',
      retriever: 'chunk',
      documentCount: 9,
      llmModel: 'model-a',
    })

    expect(a).toBe(b)
  })
})










