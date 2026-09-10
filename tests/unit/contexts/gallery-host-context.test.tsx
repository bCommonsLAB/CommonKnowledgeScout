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
 *
 * Seit M5 sagt der Gastgeber auch, gegen welche Instanz die Galerie spricht.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SAME_ORIGIN_API, createInstanceApi } from '@ks/api-client'
import {
  GalleryHostProvider,
  useGalleryHost,
  useInstanz,
  STILLER_GASTGEBER,
  SchlichtesBild,
  type GalleryHost,
} from '@ks/module-explorer/gallery/contexts/gallery-host-context'

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
    const host: GalleryHost = { jobGestartet, Bild: SchlichtesBild, instanz: SAME_ORIGIN_API }
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

describe('useInstanz', () => {
  it('liefert die Instanz des Gastgebers — im Embed die zentrale', () => {
    const instanz = createInstanceApi({ baseUrl: 'https://knowledgescout.org' })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GalleryHostProvider host={{ ...STILLER_GASTGEBER, instanz }}>{children}</GalleryHostProvider>
    )

    const { result } = renderHook(() => useInstanz(), { wrapper })

    expect(result.current).toBe(instanz)
    expect(result.current.url('/api/chat/lib-1/docs')).toBe('https://knowledgescout.org/api/chat/lib-1/docs')
  })

  it('wirft ohne Anbieter wie useGalleryHost', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useInstanz())).toThrowError(/GalleryHostProvider/)
  })
})
