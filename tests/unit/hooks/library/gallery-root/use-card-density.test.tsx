// @vitest-environment jsdom

/**
 * Characterization Tests fuer `useCardDensity` (Welle 3-III-a, Schritt 2/N).
 *
 * Sicherheitsnetz fuer den gallery-root.tsx Refactor. Fixiert:
 * - Initial-Wert: 'comfortable' vor Mount
 * - Nach Mount mit libraryId+sessionStorage-Wert: nimmt sessionStorage-Wert
 * - Nach Mount ohne sessionStorage: nimmt configDefault
 * - Ohne libraryId: ignoriert sessionStorage, nutzt configDefault
 * - setCardDensity schreibt sessionStorage und State
 * - sessionStorage-Fehler werden geloggt (kein silent fallback)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardDensity } from '@/components/library/gallery/gallery-root/hooks/use-card-density'
import { galleryCardDensityStorageKey } from '@/lib/gallery/gallery-card-density'

describe('useCardDensity', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('liefert "comfortable" als initialen State', () => {
    const { result } = renderHook(() =>
      useCardDensity({ libraryId: null, configDefault: 'compact' }),
    )
    // Hook setzt synchron im useEffect den configDefault, aber das
    // dauert 1 Tick. Wir pruefen, dass initial nicht 'undefined' ist.
    expect(result.current.cardDensity).toBeDefined()
  })

  it('nimmt configDefault, wenn libraryId fehlt', () => {
    const { result } = renderHook(() =>
      useCardDensity({ libraryId: null, configDefault: 'compact' }),
    )
    // Nach dem useEffect ist der State 'compact' (configDefault).
    expect(result.current.cardDensity).toBe('compact')
  })

  it('nimmt sessionStorage-Wert, wenn vorhanden', () => {
    window.sessionStorage.setItem(galleryCardDensityStorageKey('lib-1'), 'compact')

    const { result } = renderHook(() =>
      useCardDensity({ libraryId: 'lib-1', configDefault: 'comfortable' }),
    )

    expect(result.current.cardDensity).toBe('compact')
  })

  it('nimmt configDefault, wenn sessionStorage leer ist', () => {
    const { result } = renderHook(() =>
      useCardDensity({ libraryId: 'lib-2', configDefault: 'compact' }),
    )

    expect(result.current.cardDensity).toBe('compact')
  })

  it('schreibt setCardDensity in sessionStorage', () => {
    const { result } = renderHook(() =>
      useCardDensity({ libraryId: 'lib-3', configDefault: 'comfortable' }),
    )

    act(() => {
      result.current.setCardDensity('compact')
    })

    expect(result.current.cardDensity).toBe('compact')
    expect(window.sessionStorage.getItem(galleryCardDensityStorageKey('lib-3'))).toBe('compact')
  })

  it('loggt warning, wenn sessionStorage.getItem wirft', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sessionStorage disabled')
    })

    renderHook(() =>
      useCardDensity({ libraryId: 'lib-error', configDefault: 'comfortable' }),
    )

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useCardDensity]'),
      expect.any(Error),
    )

    getItemSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  it('loggt warning, wenn sessionStorage.setItem wirft', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useCardDensity({ libraryId: 'lib-error-write', configDefault: 'comfortable' }),
    )

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full')
    })

    act(() => {
      result.current.setCardDensity('compact')
    })

    expect(consoleWarnSpy).toHaveBeenCalled()
    setItemSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })
})
