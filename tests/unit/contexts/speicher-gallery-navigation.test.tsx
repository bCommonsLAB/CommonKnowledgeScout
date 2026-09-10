// @vitest-environment jsdom

/**
 * Die Adressierung im Speicher (M5, Embed): dieselben Parameter wie in der App
 * (`NextGalleryNavigation`), nur ohne Adresszeile — der Gast fasst die Adresse
 * der fremden Seite nicht an (Owner-Entscheidung 2026-08-29).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SpeicherGalleryNavigation } from '@ks/module-explorer/gallery/contexts/speicher-gallery-navigation'
import { useGalleryNavigation } from '@ks/module-explorer/gallery/contexts/gallery-navigation-context'

function montieren(initialParams?: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SpeicherGalleryNavigation initialParams={initialParams}>{children}</SpeicherGalleryNavigation>
  )
  return renderHook(() => useGalleryNavigation(), { wrapper })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SpeicherGalleryNavigation', () => {
  it('beginnt mit dem Anfangszustand', () => {
    const { result } = montieren('view=gallery')
    expect(result.current.params.get('view')).toBe('gallery')
  })

  it('openDocument setzt doc, closeDocument nimmt nur doc weg', () => {
    const { result } = montieren('view=gallery&sort=stars')

    act(() => result.current.openDocument('ein-buch-ab12'))
    expect(result.current.params.get('doc')).toBe('ein-buch-ab12')
    expect(result.current.params.get('sort')).toBe('stars')

    act(() => result.current.closeDocument())
    expect(result.current.params.has('doc')).toBe(false)
    expect(result.current.params.toString()).toBe('view=gallery&sort=stars')
  })

  it('ein leerer Slug aendert nichts und wird gemeldet, nicht verschluckt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = montieren('view=gallery')

    act(() => result.current.openDocument(''))

    expect(result.current.params.toString()).toBe('view=gallery')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('replace, push und Ansichtswechsel setzen den Zustand — ohne Verlauf', () => {
    const { result } = montieren('doc=x')

    act(() => result.current.pushParams(new URLSearchParams('favorites=1')))
    expect(result.current.params.toString()).toBe('favorites=1')

    act(() => result.current.replaceParams(new URLSearchParams('mode=story')))
    expect(result.current.params.toString()).toBe('mode=story')

    act(() => result.current.applyModeParams(new URLSearchParams('view=site')))
    expect(result.current.params.toString()).toBe('view=site')
  })

  it('haelt das hereingereichte Objekt nicht fest', () => {
    const { result } = montieren('')
    const next = new URLSearchParams('favorites=1')

    act(() => result.current.pushParams(next))
    next.set('favorites', '0')

    expect(result.current.params.get('favorites')).toBe('1')
  })

  it('bietet keine teilbare Adresse an — sie gehoerte der fremden Seite', () => {
    const { result } = montieren('')
    expect(result.current.documentShareUrl('ein-buch-ab12')).toBe('')
  })

  it('fasst die Adresse der Seite nicht an', () => {
    const vorher = window.location.href
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')
    const { result } = montieren('')

    act(() => result.current.openDocument('x'))
    act(() => result.current.pushParams(new URLSearchParams('favorites=1')))
    act(() => result.current.applyModeParams(new URLSearchParams('mode=story')))
    act(() => result.current.closeDocument())

    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.href).toBe(vorher)
  })
})
