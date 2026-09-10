'use client'

/**
 * Laedt die oeffentliche Library ueber den Slug und montiert die Galerie.
 *
 * Dasselbe Eintrittsprotokoll wie `ExplorerRoot` (`useExplorerLibrary`), aber
 * ohne dessen Seitenrahmen — `h-screen`, Kopfzeile, Anmelde-Hinweise: Im Embed
 * bestimmt die fremde Seite Groesse und Kopf, und eine Anmeldung gibt es nicht
 * (ADR 0008). Eine geschuetzte Library wird ausdruecklich abgelehnt.
 */

import { useMemo } from 'react'
import type { InstanceApi } from '@ks/api-client'
import { useTranslation } from '@ks/i18n/react'
import { EMBED_DETAIL_RENDERERS, GalleryRoot, useExplorerLibrary } from '@ks/module-explorer/react'

/** Der Besucher einer fremden Seite: bekannt, aber nicht angemeldet. */
const ANONYM = { isLoaded: true, isSignedIn: false } as const

function Hinweis({ children, alarm = false }: { children: string; alarm?: boolean }) {
  return (
    <p role={alarm ? 'alert' : 'status'} className="p-4 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function EmbedGalerie({ slug, instanz }: { slug: string; instanz: InstanceApi }) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 sm:px-4 sm:pb-4">
      <GalleryRoot libraryIdProp={library.id} detailRenderers={EMBED_DETAIL_RENDERERS} hideWebsiteDocs />
    </div>
  )
}
