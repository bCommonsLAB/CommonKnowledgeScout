'use client'

/**
 * Laedt die oeffentliche Library ueber den Slug und montiert die Galerie.
 *
 * Dasselbe Eintrittsprotokoll wie `ExplorerRoot` (`useExplorerLibrary`), aber
 * ohne dessen Seitenrahmen — `h-screen`, Kopfzeile, Anmelde-Hinweise: Im Embed
 * bestimmt die fremde Seite Groesse und Kopf, und eine Anmeldung gibt es nicht
 * (ADR 0008). Eine geschuetzte Library wird ausdruecklich abgelehnt.
 *
 * Fuer den Story-Modus bestimmt sie einmal Modell und Perspektive und reicht
 * beide an Kopf und Mitte; mit `perspektive` stellt der Kopf die eigene
 * Perspektive zur Wahl (Dialog, `embed-perspektive.tsx`).
 */

import { useMemo, type ReactNode } from 'react'
import { useAtom } from 'jotai'
import type { InstanceApi } from '@ks/api-client'
import type { Locale } from '@ks/i18n'
import { useTranslation } from '@ks/i18n/react'
import { EMBED_DETAIL_RENDERERS, GalleryRoot, useExplorerLibrary } from '@ks/module-explorer/react'
import { PerspektiveDialog } from '@ks/module-story/react'
import { EmbedStoryChronik, EmbedStoryKopfzeile, EmbedStoryPanel, useOeffentlichesModell } from './embed-story'
import { perspektiveDialogAtom, perspektiveFuer, useEigenePerspektive, wahlFuerDialog } from './embed-perspektive'

/** Der Besucher einer fremden Seite: bekannt, aber nicht angemeldet. */
const ANONYM = { isLoaded: true, isSignedIn: false } as const

function Hinweis({ children, alarm = false }: { children: string; alarm?: boolean }) {
  return (
    <p role={alarm ? 'alert' : 'status'} className="p-4 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export interface EmbedGalerieProps {
  slug: string
  instanz: InstanceApi
  /**
   * Montiert die drei Story-Slots (D6b): bei `view="story"` und bei
   * `view="gallery"` mit `enableStory`. Ohne sie zeigt die Galerie nur die Inhalte.
   */
  story: boolean
  /** Eigene Perspektive waehlbar (`enablePerspective`); nur zusammen mit `story`. */
  perspektive: boolean
  locale: Locale
}

export function EmbedGalerie({ slug, instanz, story: storyAnbieten, perspektive: perspektiveWaehlbar, locale }: EmbedGalerieProps) {
  const { t } = useTranslation()
  const texte = useMemo(
    () => ({
      slugMissing: t('explore.slugMissing'),
      libraryNotFound: t('explore.libraryNotFound'),
      errorLoadingLibrary: t('explore.errorLoadingLibrary'),
    }),
    [t],
  )
  const { library, loading, error } = useExplorerLibrary(slug, ANONYM, texte, instanz)
  const modell = useOeffentlichesModell(instanz, storyAnbieten)
  const [eigene, speichern] = useEigenePerspektive(library?.id ?? '', perspektiveWaehlbar && !!library)
  const [dialogOffen, setDialogOffen] = useAtom(perspektiveDialogAtom)
  const chat = library?.chat
  const perspektive = useMemo(
    () => (modell === null ? null : perspektiveFuer(chat, locale, modell, perspektiveWaehlbar ? eigene : null)),
    [chat, locale, modell, perspektiveWaehlbar, eigene],
  )
  const dialogWert = useMemo(() => (perspektive ? wahlFuerDialog(perspektive) : null), [perspektive])

  if (loading) return <Hinweis>{t('gallery.loading')}</Hinweis>
  if (error || !library) return <Hinweis alarm>{error ?? t('explore.libraryNotFound')}</Hinweis>
  if (library.requiresAuth) {
    return (
      <Hinweis alarm>
        {t('embed.libraryNotPublic', {
          defaultValue: 'Diese Library ist nicht öffentlich und kann nicht eingebettet werden.',
        })}
      </Hinweis>
    )
  }

  // Die Perspektive ist erst waehlbar, wenn das Modell feststeht — ohne Modell gibt es keine Fragen.
  const wahl = perspektiveWaehlbar && dialogWert && dialogWert.llmModel !== '' ? dialogWert : null

  // Die Story-Slots nur, wenn die Story angeboten wird: Ohne Slot gibt es keinen
  // Weg in den Story-Modus und keinen Story-Knopf in der Detailansicht (M5).
  const geladen = library
  const story = storyAnbieten
    ? {
        storyPanel: (_libraryId: string, ctx?: { filterAnzeige: ReactNode }) => (
          <EmbedStoryPanel library={geladen} instanz={instanz} perspektive={perspektive} filterAnzeige={ctx?.filterAnzeige} />
        ),
        storyChronik: (libraryId: string, ctx?: { schliessen: () => void }) => (
          <EmbedStoryChronik libraryId={libraryId} instanz={instanz} onGewaehlt={ctx?.schliessen} />
        ),
        storyHeader: ({ onBackToGallery, onOpenChronik, onOpenQuellen }: { onBackToGallery: () => void; onOpenChronik?: () => void; onOpenQuellen?: () => void }) => (
          <>
            <EmbedStoryKopfzeile
              onBackToGallery={onBackToGallery}
              onOpenChronik={onOpenChronik}
              onOpenQuellen={onOpenQuellen}
              perspektive={wahl ? { wahl, onOpen: () => setDialogOffen(true) } : undefined}
            />
            {wahl && <PerspektiveDialog open={dialogOffen} onOpenChange={setDialogOffen} wert={wahl} onSpeichern={speichern} />}
          </>
        ),
      }
    : {}

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 sm:px-4 sm:pb-4">
      <GalleryRoot libraryIdProp={library.id} detailRenderers={EMBED_DETAIL_RENDERERS} hideWebsiteDocs {...story} />
    </div>
  )
}
