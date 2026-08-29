// @vitest-environment jsdom

/**
 * Tests fuer den Gastgeber-Vertrag der Galerie.
 *
 * Vier Galerie-Komponenten meldeten angestossene Hintergrund-Jobs frueher
 * direkt an `jobMonitorPanelOpenAtom` — die Werkbank-Anzeige. Seit der Welle
 * „Gruppe B" sagen sie nur noch `jobGestartet()`; was daraus wird, entscheidet
 * der Gastgeber (Galerie-Audit, Gruppe B).
 *
 * Warum ein Test und kein Browser-Durchgang: Die vier Melder sind
 * besitzer-only. In einer abgemeldeten Sitzung rendern sie nicht, der Hook
 * wird also nie ausgefuehrt — live geprueft und genau das gesehen. Ein
 * Owner-Durchgang haette einen echten Neuberechnungs-Job gegen die
 * Produktivdatenbank gestartet.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  GalleryHostProvider,
  useGalleryHost,
  STILLER_GASTGEBER,
  type GalleryHost,
} from '@/contexts/gallery-host-context'

describe('useGalleryHost', () => {
  it('wirft ohne Anbieter, statt still nichts zu tun', () => {
    // Ein fehlender Anbieter ist ein Verdrahtungsfehler. Ein stiller Default
    // wuerde ihn in „der Job-Monitor geht halt nicht auf" verwandeln — genau
    // die Sorte Fehler, die niemand meldet (no-silent-fallbacks).
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useGalleryHost())).toThrowError(/GalleryHostProvider/)
  })

  it('reicht den Gastgeber durch', () => {
    const jobGestartet = vi.fn()
    const host: GalleryHost = { jobGestartet }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GalleryHostProvider host={host}>{children}</GalleryHostProvider>
    )

    const { result } = renderHook(() => useGalleryHost(), { wrapper })
    result.current.jobGestartet()

    expect(jobGestartet).toHaveBeenCalledTimes(1)
  })

  it('der stille Gastgeber tut nichts und wirft nicht', () => {
    // Das ist der Embed-Fall: eine fremde Seite hat keinen Job-Monitor.
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GalleryHostProvider host={STILLER_GASTGEBER}>{children}</GalleryHostProvider>
    )

    const { result } = renderHook(() => useGalleryHost(), { wrapper })
    expect(() => result.current.jobGestartet()).not.toThrow()
  })
})
