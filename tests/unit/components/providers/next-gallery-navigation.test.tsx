// @vitest-environment jsdom

/**
 * Die Adressierungs-Bruecke der Voll-App, je Route festgehalten (Welle M4f).
 *
 * Vor M4f navigierten `gallery-root`, `use-gallery-mode`,
 * `switch-to-story-mode-button` und `filter-context-bar` selbst — jede mit
 * ihrer eigenen Regel, wann `push` und wann `replace`, und wohin. Diese Regeln
 * sind in `NextGalleryNavigation` zusammengezogen und hier abgelesen
 * festgehalten. Die Galerie weiss seither nicht mehr, auf welcher Seite sie
 * steht; dieser Test weiss es fuer sie.
 *
 * `openDocument`/`closeDocument` sind hier NICHT wiederholt — sie laufen
 * unveraendert ueber `document-navigation.ts`, dessen 16 Faelle in
 * `document-navigation-routen.test.ts` liegen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { NextGalleryNavigation } from '@/components/providers/next-gallery-navigation'
import { useGalleryNavigation } from '@/contexts/gallery-navigation-context'

let currentPath: string | null = '/library/gallery'
let currentSearch = ''
const push = vi.fn()
const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => currentPath,
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <NextGalleryNavigation>{children}</NextGalleryNavigation>
}

/** Die Bruecke unter einer Adresse montieren und ihren Vertrag holen. */
function bruecke(path: string | null, search = '') {
  currentPath = path
  currentSearch = search
  return renderHook(() => useGalleryNavigation(), { wrapper }).result.current
}

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NextGalleryNavigation', () => {
  it('spiegelt die Adress-Parameter', () => {
    const nav = bruecke('/library/gallery', 'sort=stars&doc=x')
    expect(nav.params.get('sort')).toBe('stars')
    expect(nav.params.get('doc')).toBe('x')
  })

  describe('applyModeParams — Ansichtswechsel', () => {
    it('auf /explore ohne Verlaufseintrag, am aktuellen Pfad', () => {
      bruecke('/explore/sfscon', 'view=site').applyModeParams(new URLSearchParams('mode=story'))
      expect(replace).toHaveBeenCalledWith('/explore/sfscon?mode=story')
      expect(push).not.toHaveBeenCalled()
    })

    it('auf /library/gallery MIT Verlaufseintrag', () => {
      bruecke('/library/gallery').applyModeParams(new URLSearchParams('mode=story'))
      expect(push).toHaveBeenCalledWith('/library/gallery?mode=story')
      expect(replace).not.toHaveBeenCalled()
    })

    it('ohne Parameter nur der Pfad — kein haengendes Fragezeichen', () => {
      bruecke('/explore/sfscon', 'mode=story').applyModeParams(new URLSearchParams(''))
      expect(replace).toHaveBeenCalledWith('/explore/sfscon')
    })
  })

  describe('replaceParams — Story-Wechsel aus der Detailansicht', () => {
    it('auf /explore die Slug-Route, ohne Scrollsprung', () => {
      bruecke('/explore/sfscon', 'doc=x').replaceParams(new URLSearchParams('mode=story'))
      expect(replace).toHaveBeenCalledWith('/explore/sfscon?mode=story', { scroll: false })
    })

    it('sonst immer /library/gallery — auch von einer anderen /library-Seite', () => {
      bruecke('/library', '').replaceParams(new URLSearchParams('mode=story'))
      expect(replace).toHaveBeenCalledWith('/library/gallery?mode=story', { scroll: false })
    })
  })

  describe('pushParams — Filter-Knoepfe', () => {
    it('am aktuellen Pfad, mit Verlaufseintrag', () => {
      bruecke('/explore/sfscon', '').pushParams(new URLSearchParams('favorites=1'))
      expect(push).toHaveBeenCalledWith('/explore/sfscon?favorites=1')
    })

    it('ohne Parameter nur der Pfad', () => {
      bruecke('/library/gallery', 'favorites=1').pushParams(new URLSearchParams(''))
      expect(push).toHaveBeenCalledWith('/library/gallery')
    })
  })

  describe('openPerspective — Sprung zur Perspektiven-Wahl', () => {
    it('auf /explore zur Perspektiven-Seite des Slugs', () => {
      bruecke('/explore/sfscon').openPerspective('lib-1')
      expect(push).toHaveBeenCalledWith('/explore/sfscon/perspective')
    })

    it('auf /library/gallery mit libraryId und Herkunft, bestehende Parameter bleiben', () => {
      bruecke('/library/gallery', 'sort=stars').openPerspective('lib-1')
      expect(push).toHaveBeenCalledWith('/library/gallery/perspective?sort=stars&libraryId=lib-1&from=story')
    })

    it('auf /library/gallery ohne libraryId gibt es nichts zu springen', () => {
      bruecke('/library/gallery').openPerspective(null)
      expect(push).not.toHaveBeenCalled()
    })

    it('von der Perspektiven-Seite selbst nie — sonst Schleife', () => {
      bruecke('/explore/sfscon/perspective').openPerspective('lib-1')
      bruecke('/library/gallery/perspective').openPerspective('lib-1')
      expect(push).not.toHaveBeenCalled()
    })
  })
})
