'use client'

/**
 * Die montierbare Wurzelkomponente des Explorer-Moduls (Landkarte §5, Zeile
 * M4; ADR 0008 §4).
 *
 * Sie bekommt den Slug als Prop statt ihn aus `useParams()` zu lesen und
 * kennt keinen Auth-Anbieter — beides Voraussetzung dafuer, dass sie ausserhalb
 * des Next.js-Datei-Routings montiert werden kann: per `next/dynamic` in der
 * Multi-Site-Runtime, im AECED-Embed (M5) und in der Electron-Huelle.
 *
 * Was sie NICHT enthaelt, steht als Slot im Props-Vertrag (`types.ts`): die
 * Galerie liegt mit 1.319 Zeilen und 38 App-Importen noch in der Anwendung und
 * folgt in einer eigenen Welle (Strangler-Prinzip, Migrationsstrategie G3).
 */

import * as React from 'react'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { useExplorerLibrary } from './use-explorer-library'
import { ExplorerHeader } from './explorer-header'
import type { ExplorerRootProps } from './types'

/** Ganzseitiger Ladezustand — solange Library ODER Anmeldezustand offen sind. */
function ExplorerLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Rahmen fuer die Zugriffs-Hinweise (Anmeldung, Wartezustand, Anfrage). */
function ExplorerNoticePage({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto px-4 py-8">{children}</div>
}

export function ExplorerRoot({
  slug,
  viewer,
  renderGallery,
  renderSignInPrompt,
  renderNotice,
}: ExplorerRootProps) {
  const { t } = useTranslation()

  const texts = React.useMemo(() => ({
    slugMissing: t('explore.slugMissing'),
    libraryNotFound: t('explore.libraryNotFound'),
    errorLoadingLibrary: t('explore.errorLoadingLibrary'),
  }), [t])

  const {
    library, context, loading, error, accessStatus, requestingAccess, requestAccess,
  } = useExplorerLibrary(slug, viewer, texts)

  if (loading || !viewer.isLoaded) {
    return <ExplorerLoading />
  }

  if (error || !library || !context) {
    return (
      <ExplorerNoticePage>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('explore.error')}</AlertTitle>
          <AlertDescription>{error || t('explore.libraryNotFound')}</AlertDescription>
        </Alert>
      </ExplorerNoticePage>
    )
  }

  if (library.requiresAuth && accessStatus && !accessStatus.hasAccess) {
    if (!viewer.isSignedIn) {
      return (
        <ExplorerNoticePage>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Anmeldung erforderlich</AlertTitle>
            <AlertDescription>
              Diese Library erfordert eine Anmeldung und Freigabe. Bitte melden Sie sich an, um fortzufahren.
            </AlertDescription>
          </Alert>
          <div className="mt-4">{renderSignInPrompt({ slug })}</div>
        </ExplorerNoticePage>
      )
    }

    if (accessStatus.status === 'pending') {
      return (
        <ExplorerNoticePage>
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Ihre Anfrage wird bearbeitet</AlertTitle>
            <AlertDescription>
              Ihre Zugriffsanfrage wurde erhalten und wird von den Administratoren geprüft. Sie erhalten eine E-Mail, sobald über Ihre Anfrage entschieden wurde.
            </AlertDescription>
          </Alert>
        </ExplorerNoticePage>
      )
    }

    return (
      <ExplorerNoticePage>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Zugriff erforderlich</AlertTitle>
          <AlertDescription>
            Diese Library erfordert eine Freigabe. Bitte stellen Sie eine Zugriffsanfrage.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={requestAccess} disabled={requestingAccess}>
            {requestingAccess ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet...
              </>
            ) : (
              'Zugriff anfragen'
            )}
          </Button>
        </div>
      </ExplorerNoticePage>
    )
  }

  // Website-Landingpage (WebsiteLandingLive) speist sich aus Live-Docs und ist
  // fuer alle (auch anonyme) Besucher der oeffentlichen Library nutzbar.
  // Trigger ist allein das Flag `siteEnabled` — kein Legacy-web/-Snapshot mehr.
  const showSiteTab = library.siteEnabled === true

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      <ExplorerHeader library={library} renderNotice={renderNotice} />

      {/* Padding-Top bewusst auf 0: die Tabs (Inhalte / Story Mode) sollen direkt unter der
         Trennlinie des Page-Headers andocken — analog zur Library-Gallery-Ansicht.
         Seitliches und unteres Padding bleiben wie zuvor (Inhalte sollen nicht am Rand kleben). */}
      <div className="flex-1 min-h-0 overflow-hidden px-2 pt-0 pb-2 sm:px-4 sm:pb-4">
        {/* flex flex-col noetig: sonst ist das flex-1 des Galerie-Rootes wirkungslos,
           der Inhalt waechst ueber die Wrapper-Hoehe hinaus und overflow-hidden schneidet
           unten ab (Symptom: Summen-Fusszeile der Tabelle nicht/halb sichtbar). */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {renderGallery({ libraryId: library.id, showSiteTab })}
        </div>
      </div>
    </div>
  )
}
