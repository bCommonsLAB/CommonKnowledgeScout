import { describe, it, expect } from 'vitest'
import {
  isLibraryPublishable,
  assertLibraryPublishable,
  LibraryNotVerifiedError,
} from '@/lib/library-verification/publish-gate'

describe('publish-gate', () => {
  it('erlaubt Publikation nur fuer verified', () => {
    expect(isLibraryPublishable('verified')).toBe(true)
    expect(isLibraryPublishable('unchecked')).toBe(false)
    expect(isLibraryPublishable('needs-repair')).toBe(false)
  })

  it('assert wirft fuer nicht-gepruefte Library', () => {
    expect(() => assertLibraryPublishable('lib-1', 'unchecked')).toThrow(LibraryNotVerifiedError)
    expect(() => assertLibraryPublishable('lib-1', 'needs-repair')).toThrow(LibraryNotVerifiedError)
  })

  it('assert passiert fuer gepruefte Library', () => {
    expect(() => assertLibraryPublishable('lib-1', 'verified')).not.toThrow()
  })

  it('Fehler traegt libraryId und status', () => {
    try {
      assertLibraryPublishable('lib-X', 'needs-repair')
      throw new Error('sollte werfen')
    } catch (e) {
      expect(e).toBeInstanceOf(LibraryNotVerifiedError)
      const err = e as LibraryNotVerifiedError
      expect(err.libraryId).toBe('lib-X')
      expect(err.status).toBe('needs-repair')
    }
  })
})
