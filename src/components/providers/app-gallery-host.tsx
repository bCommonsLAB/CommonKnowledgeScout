'use client'

/**
 * @fileoverview Der Gastgeber der Voll-App: Job-Meldungen klappen den Monitor auf.
 *
 * @description
 * Dritte Bruecke nach `ClerkGalleryViewerBridge` (wer schaut zu) und
 * `NextGalleryNavigation` (wie wird adressiert). Dieselbe Form: Die Galerie
 * sagt WAS, die App entscheidet WIE.
 *
 * Hier: Meldet die Galerie einen angestossenen Hintergrund-Job, klappt die
 * App den Job-Monitor der Werkbank auf — wie bisher, nur nicht mehr aus der
 * Galerie heraus.
 *
 * @module providers
 */

import { useMemo, type ReactNode } from 'react'
import { useSetAtom } from 'jotai'
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom'
import { GalleryHostProvider, type GalleryHost } from '@/contexts/gallery-host-context'

export function AppGalleryHost({ children }: { children: ReactNode }) {
  const setJobPanelOpen = useSetAtom(jobMonitorPanelOpenAtom)

  const host = useMemo<GalleryHost>(
    () => ({
      jobGestartet: () => setJobPanelOpen(true),
    }),
    [setJobPanelOpen]
  )

  return <GalleryHostProvider host={host}>{children}</GalleryHostProvider>
}
