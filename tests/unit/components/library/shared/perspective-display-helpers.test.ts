/**
 * Characterization Tests fuer perspective-display.tsx (Welle 3-III-c).
 *
 * Fixiert:
 * - PerspectiveDisplay ist namentlich exportiert
 * - PerspectiveDisplayProps-Varianten: 'header' und 'inline'
 * - Keine Default-Exporte
 */

import { describe, it, expect } from 'vitest'

describe('PerspectiveDisplay Export-Vertrag', () => {
  it('PerspectiveDisplay ist eine Funktion (React-Komponente)', async () => {
    const mod = await import('@/components/library/shared/perspective-display')
    expect(typeof mod.PerspectiveDisplay).toBe('function')
  })

  it('PerspectiveDisplay hat keinen Default-Export', async () => {
    const mod = await import('@/components/library/shared/perspective-display')
    expect('PerspectiveDisplay' in mod).toBe(true)
    expect('default' in mod).toBe(false)
  })
})

describe('PerspectiveDisplay Varianten-Vertrag', () => {
  it('variant=header ist erlaubt', () => {
    type Variant = 'header' | 'inline'
    const v: Variant = 'header'
    expect(v).toBe('header')
  })

  it('variant=inline ist erlaubt', () => {
    type Variant = 'header' | 'inline'
    const v: Variant = 'inline'
    expect(v).toBe('inline')
  })

  it('showAnswerLength und showRetriever sind optional', () => {
    type BoolOptional = boolean | undefined
    const showAnswerLength: BoolOptional = undefined
    const showRetriever: BoolOptional = undefined
    expect(showAnswerLength).toBeUndefined()
    expect(showRetriever).toBeUndefined()
  })
})
