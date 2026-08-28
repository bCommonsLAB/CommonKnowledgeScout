"use client"

/**
 * Oeffentliche Explorer-Seite — seit Welle M4 nur noch der Montagepunkt.
 *
 * Die Wurzelkomponente liegt in `@ks/module-explorer/react` (ADR 0008 §4).
 * Diese Datei liefert ihr, was das Modul nicht kennen darf: den Slug aus dem
 * Datei-Routing, die Clerk-Identitaet und die drei Slots (Anmelde-Aufforderung,
 * Verifikations-Hinweis, Galerie).
 */

import React from "react"
import { useParams } from "next/navigation"
import { useUser, SignInButton } from "@clerk/nextjs"
import { Button } from '@ks/ui'
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { ExplorerRoot } from '@ks/module-explorer/react'
import { LibraryVerificationWarning } from '@/components/library/library-verification-warning'

const GalleryClient = dynamic(() => import("@/app/library/gallery/client").then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
})

export default function ExplorePage() {
  const params = useParams()
  const { isLoaded, isSignedIn } = useUser()
  const slug = params?.slug as string

  return (
    <ExplorerRoot
      slug={slug}
      viewer={{ isLoaded, isSignedIn: isSignedIn === true }}
      renderSignInPrompt={({ slug: targetSlug }) => (
        <SignInButton mode="modal" fallbackRedirectUrl={`/explore/${targetSlug}`}>
          <Button>
            Zur Anmeldung
          </Button>
        </SignInButton>
      )}
      renderNotice={({ libraryId }) => (
        <LibraryVerificationWarning context="public-open" libraryId={libraryId} />
      )}
      renderGallery={({ libraryId, showSiteTab }) => (
        <GalleryClient
          libraryIdProp={libraryId}
          showSiteTab={showSiteTab}
          defaultToSite={showSiteTab}
          hideWebsiteDocs={true}
        />
      )}
    />
  )
}
