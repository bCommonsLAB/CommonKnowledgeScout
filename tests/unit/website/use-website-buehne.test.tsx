// @vitest-environment jsdom
/**
 * Schalter je Library fuer die Common-UX-Buehne (Plan `commonux-buehne-fragen-sektion`, K3):
 * Ohne `publicPublishing.stageEnabled` gibt es weder Symbol noch Buehne — auch nicht ueber
 * `?buehne=` in der Adresse.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { useWebsiteBuehne } from '@/components/library/website/buehne/use-website-buehne'

// Der Player selbst wird hier nicht geladen (Stile aus dem Buendel); es zaehlt nur, OB geladen wird.
const geladen = vi.hoisted(() => ({ mal: 0 }))
vi.mock('@/components/library/website/buehne/website-buehne', () => {
  geladen.mal += 1
  return { WEBSITE_BUEHNE: { ebene: () => null, farbeFuerBeleg: () => '#000000' } }
})

function medium(passt: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches: passt, addEventListener: () => undefined, removeEventListener: () => undefined }))
}

function mitAdresse(suche: string) {
  return ({ children }: { children: ReactNode }) => <NuqsTestingAdapter searchParams={suche}>{children}</NuqsTestingAdapter>
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useWebsiteBuehne', () => {
  it('Schalter aus: keine Buehne, auch nicht mit ?buehne=vorn; der Player wird nicht geladen', async () => {
    medium(true)
    const vorher = geladen.mal
    const { result } = renderHook(() => useWebsiteBuehne(false), { wrapper: mitAdresse('?buehne=vorn') })
    await Promise.resolve()
    expect(result.current).toBeUndefined()
    expect(geladen.mal).toBe(vorher)
  })

  it('Schalter an, ohne Parameter: das Symbol steht da, die Buehne ist aus und nicht geladen', () => {
    medium(true)
    const { result } = renderHook(() => useWebsiteBuehne(true), { wrapper: mitAdresse('') })
    expect(result.current?.modus).toBe('aus')
    expect(result.current?.darstellung).toBeUndefined()
  })

  it('Schalter an, ?buehne=vorn: Zustand vorn', () => {
    medium(true)
    const { result } = renderHook(() => useWebsiteBuehne(true), { wrapper: mitAdresse('?buehne=vorn') })
    expect(result.current?.modus).toBe('vorn')
  })

  it('Schalter an, schmaler Bildschirm oder erhoehter Kontrast: keine Buehne', () => {
    medium(false)
    const { result } = renderHook(() => useWebsiteBuehne(true), { wrapper: mitAdresse('?buehne=an') })
    expect(result.current).toBeUndefined()
  })
})
