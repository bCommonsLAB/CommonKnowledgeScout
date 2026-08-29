'use client'

import React from 'react'
import { GalleryRoot, type GalleryRootProps } from '@/components/library/gallery/gallery-root'
import { NextGalleryNavigation } from '@/components/providers/next-gallery-navigation'
import { AppGalleryHost } from '@/components/providers/app-gallery-host'
import { CaptureContentButton } from '@/components/submissions/capture-content-button'

/**
 * Montagepunkt der Galerie in der Voll-App.
 *
 * Hier — und nicht im Wurzel-Layout — wird hereingereicht, was die Galerie
 * ueber ihre Umgebung braucht:
 *
 * - **Adressierung**: wie ein Dokument in die Adresszeile kommt.
 * - **Gastgeber**: was passiert, wenn ein Hintergrund-Job startet.
 * - **Kopf-Aktionen**: der Erfassungs-Knopf, ein anderes Modul.
 *
 * Nicht im Layout, weil nur die Galerie das braucht und `useSearchParams` dort
 * jede Seite dynamisch machen wuerde. Beide Routen (`/library/gallery` und
 * `/explore/[slug]`) montieren ueber diese Datei.
 */
export default function GalleryClient(props: GalleryRootProps = {}) {
  return (
    <NextGalleryNavigation>
      <AppGalleryHost>
        <GalleryRoot
          {...props}
          kopfAktionen={(libraryId) => <CaptureContentButton libraryId={libraryId} />}
        />
      </AppGalleryHost>
    </NextGalleryNavigation>
  )
}
