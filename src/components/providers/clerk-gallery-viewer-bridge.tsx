'use client'

/**
 * @fileoverview Reicht den angemeldeten Nutzer als Galerie-Betrachter herein.
 *
 * @description
 * Gegenstueck zu `library-change-bridge.tsx` aus M4e: Die Galerie definiert
 * nur, WAS sie ueber den Betrachter wissen muss (`GalleryViewer`); WOHER die
 * Angaben kommen, reicht diese Bruecke herein. So kennt die Galerie keinen
 * Auth-Anbieter, und Clerk bleibt eine Entscheidung der App.
 *
 * Damit ist dieselbe Galerie in beiden Welten lauffaehig:
 * - Voll-App: diese Bruecke, gespeist aus Clerk
 * - Embed: `ANONYMOUS_VIEWER` — dort gibt es per ADR 0008 keine Anmeldung
 *
 * Die Bruecke sitzt in der Provider-Kette von `layout.tsx` INNERHALB von
 * `ClerkProvider` (sie liest dessen Hooks) und umschliesst alles, was die
 * Galerie-Hooks nutzt — auch `filter-context-bar` und die
 * Verifikations-Abzeichen ausserhalb des Galerie-Ordners.
 *
 * @module providers
 */

import { useMemo, type ReactNode } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { GalleryViewerProvider, type GalleryViewer } from '@/contexts/gallery-viewer-context'
import { getPreferredUserEmail } from '@/lib/auth/user-email'
import { getPreferredUserDisplayName } from '@/lib/auth/user-display-name'

export function ClerkGalleryViewerBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  const viewer = useMemo<GalleryViewer>(
    () => ({
      isLoaded,
      // `isSignedIn` ist bei Clerk `boolean | undefined`, solange nicht geladen.
      isSignedIn: isSignedIn === true,
      email: isSignedIn ? getPreferredUserEmail(user) : '',
      displayName: isSignedIn ? getPreferredUserDisplayName(user) : '',
    }),
    [isLoaded, isSignedIn, user]
  )

  return <GalleryViewerProvider viewer={viewer}>{children}</GalleryViewerProvider>
}
