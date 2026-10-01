'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { GalleryRoot, type GalleryRootProps } from '@ks/module-explorer/react'
import { GalleryAppProviders } from '@/components/providers/gallery-app-providers'
import { CaptureContentButton } from '@/components/submissions/capture-content-button'
import { DETAIL_RENDERERS } from '@/components/library/gallery-detail-renderers'
import { WebsiteLandingLive } from '@/components/library/website/website-landing-live'
import { StoryModeHeader } from '@/components/library/story/story-mode-header'
import { LibraryVerificationBadge } from '@/components/library/library-verification-badge'
import { StoryChronikMount } from '@/components/library/story/story-chronik-mount'
import { StoryAuswahlUrl } from '@/components/library/story/story-auswahl-url'

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
 * - **Story-Chronik** (D1): Gliederung und Sitzungen aus `@ks/module-story`,
 *   mit Anmeldung und aktiver Sitzung der App verdrahtet.
 * - **Story-Auswahl in der Adresse** (D2): `q=<queryId>` per nuqs, neben dem
 *   Chat-Panel montiert — das Paket kennt keine Adresszeile.
 * - **Detail-Renderer** (M4g): welche Ansicht zu welchem Typ gehoert.
 * - **Website-Ansicht**, **Story-Kopf**, **Verifikations-Abzeichen** (M4g):
 *   drei App-Bausteine, die die Galerie nur noch zeigt, nicht mehr kennt.
 *
 * Nicht im Layout, weil nur die Galerie das braucht und `useSearchParams` dort
 * jede Seite dynamisch machen wuerde. Beide Routen (`/library/gallery` und
 * `/explore/[slug]`) montieren ueber diese Datei.
 */
/**
 * Was die Seiten der Voll-App der Galerie mitgeben — die Slots (Renderer,
 * Website, Story, Abzeichen, Erfassung) setzt dieser Montagepunkt selbst.
 */
export type GalleryClientProps = Omit<
  GalleryRootProps,
  'detailRenderers' | 'siteView' | 'storyHeader' | 'storyPanel' | 'storyChronik' | 'verifikationsAbzeichen' | 'kopfAktionen'
>

export default function GalleryClient(props: GalleryClientProps = {}) {
  return (
    <GalleryAppProviders>
      <GalleryRoot
        {...props}
        kopfAktionen={(libraryId) => <CaptureContentButton libraryId={libraryId} />}
        storyPanel={(libraryId) => (
          <>
            <StoryAuswahlUrl libraryId={libraryId} />
            <LazyChatPanel libraryId={libraryId} variant='embedded' />
          </>
        )}
        storyChronik={(libraryId) => <StoryChronikMount libraryId={libraryId} />}
        detailRenderers={DETAIL_RENDERERS}
        siteView={({ libraryId, onShowGallery }) => (
          <WebsiteLandingLive libraryId={libraryId} onShowGallery={onShowGallery} />
        )}
        storyHeader={({ libraryId, onBackToGallery }) => (
          <StoryModeHeader libraryId={libraryId} onBackToGallery={onBackToGallery} />
        )}
        verifikationsAbzeichen={<LibraryVerificationBadge />}
      />
    </GalleryAppProviders>
  )
}
