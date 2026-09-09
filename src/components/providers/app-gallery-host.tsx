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
 *   Die Galerie selbst kennt `next/image` nicht mehr.
 *
 * @module providers
 */

import { useMemo, type ReactNode } from 'react'
import Image from 'next/image'
import { useSetAtom } from 'jotai'
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom'
import {
  GalleryHostProvider,
  type GalleryHost,
  type GalleryImageProps,
} from '@/contexts/gallery-host-context'

/** `next/image` hinter dem Bild-Vertrag der Galerie — Prop fuer Prop durchgereicht. */
function NextBild({ src, alt, className, fill, width, height, loading, unoptimized, onError }: GalleryImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      loading={loading}
      unoptimized={unoptimized}
      onError={onError}
    />
  )
}

export function AppGalleryHost({ children }: { children: ReactNode }) {
  const setJobPanelOpen = useSetAtom(jobMonitorPanelOpenAtom)

  const host = useMemo<GalleryHost>(
    () => ({
      jobGestartet: () => setJobPanelOpen(true),
      Bild: NextBild,
    }),
    [setJobPanelOpen]
  )

  return <GalleryHostProvider host={host}>{children}</GalleryHostProvider>
}
