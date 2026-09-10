'use client'

/**
 * @fileoverview Der Gastgeber der Voll-App: Job-Meldungen klappen den Monitor auf, Bilder kommen aus `next/image`.
 *
 * @description
 * Dritte Bruecke nach `ClerkGalleryViewerBridge` (wer schaut zu) und
 * `NextGalleryNavigation` (wie wird adressiert). Dieselbe Form: Die Galerie
 * sagt WAS, die App entscheidet WIE.
 *
 * - Meldet die Galerie einen angestossenen Hintergrund-Job, klappt die App
 *   den Job-Monitor der Werkbank auf — wie bisher, nur nicht mehr aus der
 *   Galerie heraus.
 * - Bilder rendert die App mit `next/image` — optimiert ueber `/_next/image`
 *   und die `remotePatterns` in `next.config.js`, genau wie vor Welle M4f.
 *   Die Galerie selbst kennt `next/image` nicht mehr. `NextBild` hat seit M5
 *   eine eigene Datei, weil auch die App-Huellen der Buch-Ansicht es brauchen.
 * - Die Instanz ist die eigene Herkunft (`SAME_ORIGIN_API`): relative Pfade,
 *   wie vor Welle M5. Nur das Embed setzt hier eine fremde Basis-URL.
 *
 * @module providers
 */

import { useMemo, type ReactNode } from 'react'
import { useSetAtom } from 'jotai'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom'
import { GalleryHostProvider, type GalleryHost } from '@ks/module-explorer/react'
import { NextBild } from './next-bild'

export function AppGalleryHost({ children }: { children: ReactNode }) {
  const setJobPanelOpen = useSetAtom(jobMonitorPanelOpenAtom)

  const host = useMemo<GalleryHost>(
    () => ({
      jobGestartet: () => setJobPanelOpen(true),
      Bild: NextBild,
      instanz: SAME_ORIGIN_API,
    }),
    [setJobPanelOpen]
  )

  return <GalleryHostProvider host={host}>{children}</GalleryHostProvider>
}
