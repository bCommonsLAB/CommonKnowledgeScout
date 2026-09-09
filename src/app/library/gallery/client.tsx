'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { GalleryRoot, type GalleryRootProps } from '@/components/library/gallery/gallery-root'
import { GalleryAppProviders } from '@/components/providers/gallery-app-providers'
import { CaptureContentButton } from '@/components/submissions/capture-content-button'

// Das Story-Panel (Chat, eingebettet) faul laden — wie bisher, nur hier statt
// in der Galerie: Sie kennt `next/dynamic` seit M4f nicht mehr.
const LazyChatPanel = dynamic(
  () => import('@/components/library/chat/chat-panel').then((module) => module.ChatPanel),
  {
    ssr: false,
    loading: () => <div className='text-sm text-muted-foreground p-4'>Lade Story-Panel…</div>,
  }
)

/**
 * Montagepunkt der Galerie in der Voll-App.
 *
 * Hier — und nicht im Wurzel-Layout — wird hereingereicht, was die Galerie
 * ueber ihre Umgebung braucht:
 *
 * - **Adressierung**: wie die Galerie in die Adresszeile kommt.
 * - **Gastgeber**: Job-Meldungen und womit Bilder gerendert werden.
 * - **Kopf-Aktionen**: der Erfassungs-Knopf, ein anderes Modul.
 * - **Story-Panel**: der Chat in der eingebetteten Variante, faul geladen.
 *
 * Nicht im Layout, weil nur die Galerie das braucht und `useSearchParams` dort
 * jede Seite dynamisch machen wuerde. Beide Routen (`/library/gallery` und
 * `/explore/[slug]`) montieren ueber diese Datei.
 */
export default function GalleryClient(props: GalleryRootProps = {}) {
  return (
    <GalleryAppProviders>
      <GalleryRoot
        {...props}
        kopfAktionen={(libraryId) => <CaptureContentButton libraryId={libraryId} />}
        storyPanel={(libraryId) => <LazyChatPanel libraryId={libraryId} variant='embedded' />}
      />
    </GalleryAppProviders>
  )
}
