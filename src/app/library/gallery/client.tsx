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

// Die Story-Mitte (D6c: `StoryRoot` aus dem Story-Paket mit App-Verdrahtung)
// faul laden — hier statt in der Galerie: Sie kennt `next/dynamic` seit M4f nicht mehr.
const LazyStoryRoot = dynamic(
  () => import('@/components/library/story/story-root-mount').then((module) => module.StoryRootMount),
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
 * - **Story-Panel**: die Story-Mitte (`StoryRoot` aus `@ks/module-story`, D6c), faul geladen.
 * - **Story-Chronik** (D1): Gliederung und Sitzungen aus `@ks/module-story`,
 *   mit Anmeldung und aktiver Sitzung der App verdrahtet.
 * - **Story-Auswahl in der Adresse** (D2): `q=<queryId>` per nuqs, neben dem
 *   Chat-Panel montiert — das Paket kennt keine Adresszeile.
 * - **Chronik mobil** (D4): die Galerie zeigt den Slot im Sheet und reicht
 *   `schliessen` mit; der Story-Kopf bekommt `onOpenChronik` fuer den Knopf.
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
            <LazyStoryRoot libraryId={libraryId} />
          </>
        )}
        storyChronik={(libraryId, ctx) => <StoryChronikMount libraryId={libraryId} onGewaehlt={ctx?.schliessen} />}
        detailRenderers={DETAIL_RENDERERS}
        siteView={({ libraryId, onShowGallery }) => (
          <WebsiteLandingLive libraryId={libraryId} onShowGallery={onShowGallery} />
        )}
        storyHeader={({ libraryId, onBackToGallery, onOpenChronik }) => (
          <StoryModeHeader libraryId={libraryId} onBackToGallery={onBackToGallery} onOpenChronik={onOpenChronik} />
        )}
        verifikationsAbzeichen={<LibraryVerificationBadge />}
      />
    </GalleryAppProviders>
  )
}
