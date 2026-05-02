// @vitest-environment jsdom

/**
 * Characterization Tests fuer LocalStorage-Helper in
 * `src/components/library/chat/utils/chat-storage.ts` (Welle 3-III, Schritt 3).
 *
 * Sicherheitsnetz fuer Sub-Welle 3-III-b. Fixiert den deterministischen
 * Vertrag der getInitial*-Helper und saveChatContextToLocalStorage.
 *
 * Hinweis: Die Helpers haben aktuell "Comment-only-Catches" laut
 * `no-silent-fallbacks.mdc` — diese werden in Sub-Welle 3-III-b
 * mit Logging gefixt. Diese Tests fixieren das aktuelle Verhalten,
 * damit der Refactor das sichtbare Verhalten nicht aendert.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock fuer @/lib/chat/constants — die Defaults reichen aus, wir
// verwenden sie als Erwartungswerte. Echte Konstanten werden importiert.
import {
  getInitialTargetLanguage,
  getInitialCharacter,
  getInitialAccessPerspective,
  getInitialSocialContext,
  getInitialGenderInclusive,
  getInitialLlmModel,
  saveChatContextToLocalStorage,
} from '@/components/library/chat/utils/chat-storage'
import {
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  ACCESS_PERSPECTIVE_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
  GENDER_INCLUSIVE_DEFAULT,
  LLM_MODEL_DEFAULT,
} from '@/lib/chat/constants'

describe('chat-storage Helper', () => {
  beforeEach(() => {
    // jsdom liefert ein echtes window.localStorage; wir leeren es vor jedem Test
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getInitialTargetLanguage', () => {
    it('liefert Default-Wert, wenn LocalStorage leer ist', () => {
      expect(getInitialTargetLanguage()).toBe(TARGET_LANGUAGE_DEFAULT)
    })

    it('liest gespeicherten Wert aus LocalStorage', () => {
      window.localStorage.setItem('story-context-targetLanguage', JSON.stringify('en'))
      expect(getInitialTargetLanguage()).toBe('en')
    })

    it('liefert Default-Wert, wenn LocalStorage-Wert kein gueltiges JSON ist', () => {
      window.localStorage.setItem('story-context-targetLanguage', 'invalid-{json')
      // Aktuelles Verhalten: Comment-only-Catch → Default zurueck
      expect(getInitialTargetLanguage()).toBe(TARGET_LANGUAGE_DEFAULT)
    })
  })

  describe('getInitialCharacter (mit Migration)', () => {
    it('liefert Default-Wert, wenn LocalStorage leer ist', () => {
      expect(getInitialCharacter()).toEqual(CHARACTER_DEFAULT)
    })

    it('liest Array-Wert direkt', () => {
      const value = ['journalist', 'scientist']
      window.localStorage.setItem('story-context-character', JSON.stringify(value))
      expect(getInitialCharacter()).toEqual(value)
    })

    it('migriert Single-Value-String zu Array', () => {
      window.localStorage.setItem('story-context-character', JSON.stringify('journalist'))
      const result = getInitialCharacter()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual(['journalist'])
    })

    it('liefert Default-Wert, wenn LocalStorage-Wert kein gueltiges JSON ist', () => {
      window.localStorage.setItem('story-context-character', 'invalid')
      expect(getInitialCharacter()).toEqual(CHARACTER_DEFAULT)
    })
  })

  describe('getInitialAccessPerspective (mit Migration)', () => {
    it('liefert Default-Wert, wenn LocalStorage leer ist', () => {
      expect(getInitialAccessPerspective()).toEqual(ACCESS_PERSPECTIVE_DEFAULT)
    })

    it('liest Array-Wert direkt', () => {
      const value = ['general']
      window.localStorage.setItem('story-context-accessPerspective', JSON.stringify(value))
      expect(getInitialAccessPerspective()).toEqual(value)
    })

    it('migriert Single-Value-String zu Array', () => {
      window.localStorage.setItem('story-context-accessPerspective', JSON.stringify('general'))
      const result = getInitialAccessPerspective()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual(['general'])
    })
  })

  describe('getInitialSocialContext', () => {
    it('liefert Default-Wert, wenn LocalStorage leer ist', () => {
      expect(getInitialSocialContext()).toBe(SOCIAL_CONTEXT_DEFAULT)
    })

    it('liest gespeicherten Wert aus LocalStorage', () => {
      window.localStorage.setItem('story-context-socialContext', JSON.stringify('formal'))
      expect(getInitialSocialContext()).toBe('formal')
    })
  })

  describe('getInitialGenderInclusive', () => {
    it('liefert Default-Wert, wenn LocalStorage leer ist', () => {
      expect(getInitialGenderInclusive()).toBe(GENDER_INCLUSIVE_DEFAULT)
    })

    it('liest false aus LocalStorage', () => {
      window.localStorage.setItem('story-context-genderInclusive', JSON.stringify(false))
      expect(getInitialGenderInclusive()).toBe(false)
    })

    it('liest true aus LocalStorage', () => {
      window.localStorage.setItem('story-context-genderInclusive', JSON.stringify(true))
      expect(getInitialGenderInclusive()).toBe(true)
    })
  })

  describe('getInitialLlmModel', () => {
    it('liefert Default-Wert, wenn LocalStorage leer ist', () => {
      expect(getInitialLlmModel()).toBe(LLM_MODEL_DEFAULT)
    })
  })

  describe('saveChatContextToLocalStorage', () => {
    it('speichert alle 6 Keys in LocalStorage', () => {
      saveChatContextToLocalStorage(
        'en',
        ['journalist'],
        ['general'],
        'formal',
        true,
        LLM_MODEL_DEFAULT,
      )

      expect(window.localStorage.getItem('story-context-targetLanguage')).toBe('"en"')
      expect(window.localStorage.getItem('story-context-character')).toBe('["journalist"]')
      expect(window.localStorage.getItem('story-context-accessPerspective')).toBe('["general"]')
      expect(window.localStorage.getItem('story-context-socialContext')).toBe('"formal"')
      expect(window.localStorage.getItem('story-context-genderInclusive')).toBe('true')
      expect(window.localStorage.getItem('story-context-llmModel')).toBe(JSON.stringify(LLM_MODEL_DEFAULT))
    })

    it('loggt Fehler, wenn LocalStorage nicht verfuegbar ist', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full')
      })

      saveChatContextToLocalStorage(
        'de',
        [],
        [],
        SOCIAL_CONTEXT_DEFAULT,
        false,
        LLM_MODEL_DEFAULT,
      )

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[chat-storage]'),
        expect.any(Error),
      )

      setItemSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })
  })
})
