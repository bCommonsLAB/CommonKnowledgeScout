'use client'

/**
 * @fileoverview Der Betrachter der Galerie — als Vertrag statt als Auth-Anbieter.
 *
 * @description
 * Die Galerie fragte bisher an drei Stellen direkt bei Clerk nach, wer da ist
 * (`use-library-role`, `use-is-library-owner`, `gallery-root`). Damit hing sie
 * an einem konkreten Anmeldedienst und war nicht einbettbar.
 *
 * Sie bekommt den Betrachter jetzt hereingereicht. Das folgt dem Muster von
 * `ExplorerViewer` aus M4 — dort reichten zwei Booleans, hier sind es vier
 * Felder. Der Grund ist fachlich: Die Galerie zeigt „wer hat gesternt" und
 * „dein Kommentar", sie muss sich also in einer Liste **selbst wiedererkennen**.
 * Der Explorer musste das nie.
 *
 * Wichtig, was hier NICHT steht: Rechte. Wer was darf, entscheidet weiterhin
 * der Server bei jedem Request. Diese Angaben steuern ausschliesslich, was die
 * Oberflaeche anbietet.
 *
 * Im eingebetteten Modus sind alle vier Felder trivial —
 * `{ isLoaded: true, isSignedIn: false, email: '', displayName: '' }`. Das
 * Embed liefert per Owner-Entscheidung nur oeffentliche Inhalte (ADR 0008),
 * es gibt dort also keine Anmeldung.
 *
 * @module contexts
 */

import { createContext, useContext, type ReactNode } from 'react'

/** Was die Galerie ueber den Betrachter wissen muss — mehr nicht. */
export interface GalleryViewer {
  /** `false`, solange der Anmeldezustand noch ermittelt wird. */
  isLoaded: boolean
  isSignedIn: boolean
  /** Normalisierte E-Mail; leer, wenn nicht angemeldet. */
  email: string
  /** Anzeigename; leer, wenn nicht angemeldet. */
  displayName: string
}

/** Der Betrachter einer Seite ohne Anmeldung — der Normalfall im Embed. */
export const ANONYMOUS_VIEWER: GalleryViewer = {
  isLoaded: true,
  isSignedIn: false,
  email: '',
  displayName: '',
}

// Bewusst ohne Default: Ein fehlender Provider ist ein Verdrahtungsfehler und
// soll auffallen, statt still einen anonymen Betrachter vorzutaeuschen
// (docs/contracts/no-silent-fallbacks.md).
const GalleryViewerContext = createContext<GalleryViewer | null>(null)

export function GalleryViewerProvider({
  viewer,
  children,
}: {
  viewer: GalleryViewer
  children: ReactNode
}) {
  return <GalleryViewerContext.Provider value={viewer}>{children}</GalleryViewerContext.Provider>
}

/**
 * Liest den Betrachter. Wirft, wenn kein Provider darueber liegt — dann fehlt
 * die Verdrahtung, und ein stiller Default wuerde Anmelde-abhaengige
 * Bedienelemente grundlos verstecken.
 */
export function useGalleryViewer(): GalleryViewer {
  const viewer = useContext(GalleryViewerContext)
  if (viewer === null) {
    throw new Error(
      'useGalleryViewer ausserhalb von GalleryViewerProvider — die Galerie braucht einen Betrachter. ' +
        'In der App liefert ihn ClerkGalleryViewerBridge (layout.tsx), im Embed ANONYMOUS_VIEWER.'
    )
  }
  return viewer
}
