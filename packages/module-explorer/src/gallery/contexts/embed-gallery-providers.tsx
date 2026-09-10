'use client'

/**
 * @fileoverview Alles, was die Galerie im Embed braucht — an einer Stelle.
 *
 * @description
 * Gegenstueck zu `GalleryAppProviders` in der App. Lehre aus #248: ein
 * Buendel je Montagepunkt, nicht drei einzelne Anbieter, von denen einer
 * vergessen wird. Die drei Fragen der Galerie beantwortet das Embed so:
 *
 * - **Wer schaut zu?** Niemand Angemeldetes: `ANONYMOUS_VIEWER`. Das Embed
 *   liefert nur Oeffentliches (ADR 0008, Nachtrag 2026-08-29).
 * - **Wie wird adressiert?** Im Speicher (`SpeicherGalleryNavigation`); die
 *   Adresse der fremden Seite bleibt unberuehrt.
 * - **Wer ist der Gastgeber?** Der stille (`STILLER_GASTGEBER`: kein
 *   Job-Monitor, schlichte `<img>`) — mit der zentralen Instanz als `instanz`.
 *
 * @module contexts
 */

import { useMemo, type ReactNode } from 'react'
import type { InstanceApi } from '@ks/api-client'
import { ANONYMOUS_VIEWER, GalleryViewerProvider } from './gallery-viewer-context'
import { GalleryHostProvider, STILLER_GASTGEBER, type GalleryHost } from './gallery-host-context'
import { SpeicherGalleryNavigation } from './speicher-gallery-navigation'

export interface EmbedGalleryProvidersProps {
  /**
   * Die zentrale Instanz, z. B. `createInstanceApi({ baseUrl: 'https://knowledgescout.org' })`.
   * Stabile Identitaet: Die Galerie-Hooks fuehren sie in ihren Abhaengigkeiten.
   */
  instanz: InstanceApi
  /** Anfangszustand der Adressierung, z. B. `view=gallery`. */
  initialParams?: string
  children: ReactNode
}

export function EmbedGalleryProviders({ instanz, initialParams, children }: EmbedGalleryProvidersProps) {
  const host = useMemo<GalleryHost>(() => ({ ...STILLER_GASTGEBER, instanz }), [instanz])

  return (
    <GalleryViewerProvider viewer={ANONYMOUS_VIEWER}>
      <GalleryHostProvider host={host}>
        <SpeicherGalleryNavigation initialParams={initialParams}>{children}</SpeicherGalleryNavigation>
      </GalleryHostProvider>
    </GalleryViewerProvider>
  )
}
