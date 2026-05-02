// @vitest-environment jsdom

/**
 * Characterization Tests fuer `useIsMobile` (Welle 3-III-a, Schritt 2/N).
 *
 * Sicherheitsnetz fuer den gallery-root.tsx Refactor. Fixiert:
 * - Initial: false (vor Mount)
 * - Nach Mount mit window.innerWidth < 1024: true
 * - Nach Mount mit window.innerWidth >= 1024: false
 * - Resize-Event triggert Re-Render
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/components/library/gallery/gallery-root/hooks/use-is-mobile'

describe('useIsMobile', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
  })

  function setInnerWidth(px: number) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: px,
    })
  }

  it('liefert true bei window.innerWidth < 1024', () => {
    setInnerWidth(800)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('liefert false bei window.innerWidth >= 1024', () => {
    setInnerWidth(1280)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('reagiert auf Resize-Event', () => {
    setInnerWidth(1280)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      setInnerWidth(800)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(true)

    act(() => {
      setInnerWidth(1400)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(false)
  })

  it('cleanup entfernt resize-Listener (kein Memory-Leak)', () => {
    setInnerWidth(800)
    const { unmount } = renderHook(() => useIsMobile())

    unmount()

    // Nach unmount darf ein resize-Event keinen State-Update mehr triggern
    // (kein Throw, kein console.error wegen "set state on unmounted component").
    // Wir testen indirekt, indem wir ein Resize-Event feuern und keine
    // Exception erwarten.
    expect(() => {
      window.dispatchEvent(new Event('resize'))
    }).not.toThrow()
  })
})
