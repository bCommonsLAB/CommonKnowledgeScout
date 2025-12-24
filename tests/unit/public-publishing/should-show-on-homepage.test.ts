/**
 * @fileoverview Unit Tests for shouldShowOnHomepage
 *
 * Ziel: Das Default-Verhalten muss stabil bleiben.
 * - Fehlendes Flag => sichtbar (true)
 * - Explizit false => nicht sichtbar (false)
 */

import { describe, it, expect } from 'vitest'
import { shouldShowOnHomepage } from '@/lib/public-publishing'

describe('shouldShowOnHomepage', () => {
  it('should return true when the flag is missing (backwards-compatibility)', () => {
    expect(shouldShowOnHomepage(undefined)).toBe(true)
  })

  it('should return true when the flag is true', () => {
    expect(shouldShowOnHomepage(true)).toBe(true)
  })

  it('should return false only when the flag is explicitly false', () => {
    expect(shouldShowOnHomepage(false)).toBe(false)
  })
})


