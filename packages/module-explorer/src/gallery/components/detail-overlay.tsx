'use client'

/**
 * DetailOverlay – Anzeige eines Dokuments im Slide-In.
 *
 * Seit D6b (Plan `story-dreiteilung-fragenchronik`) nur noch Verdrahtung und
 * Layout; die Teile liegen unter `detail-overlay/`:
 * - Props-Vertrag (`DetailRenderer`, `DetailRenderProps`): `types.ts`
 * - Doc-Meta laden und sprach-veredeln: `use-doc-meta.ts`
 * - Bewertungsmodus, Stern, Geschwister-Sequenz: `use-bewertung.ts`
 * - Kopf (Titel, Pfeile, Stern, Kommentare, Teilen, Story-Knopf): `detail-kopf.tsx`
 * - Inhalt (Ansicht zum Typ, SDG-Profil, Kommentare): `detail-body.tsx`
 * - Sprung auf die Seite (D7): `seiten-sprung.ts`
 *
 * Refactor (Doc-Translations): Die Anzeige folgt dem globalen
 * `LanguageSwitcher` (`useTranslation().locale`); `docMetaJson` wird VOR dem
 * Detail-Mapping mit `translations.detail.<locale>` ueberlagert (Fallback
 * `<fallbackLocale>` und Original), die Mapper bleiben sprachneutral.
 */

import React from 'react'
import { ScrollArea } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { useLibraries } from '@ks/shell/react'
import { useLibraryRole } from '../hooks/use-library-role'
import { useInstanz } from '../contexts/gallery-host-context'
import { SourceCommentsPanel } from './source-comments-panel'
import { DetailBody } from './detail-overlay/detail-body'
import { DetailKopf } from './detail-overlay/detail-kopf'
import { useSeitenSprung } from './detail-overlay/seiten-sprung'
import { useBewertung } from './detail-overlay/use-bewertung'
import { useDocMeta } from './detail-overlay/use-doc-meta'
import type { DetailOverlayProps, DetailRenderer, DetailRenderProps } from './detail-overlay/types'

export type { DetailOverlayProps, DetailRenderer, DetailRenderProps }

export function DetailOverlay(props: DetailOverlayProps) {
  const { open, onClose, libraryId, fileId, viewType, detailRenderers, page, title, fallbackLocale } = props
  const { t, locale } = useTranslation()
  const { isMember, isSignedIn } = useLibraryRole(libraryId)
  const instanz = useInstanz()
  // SDG-Profil ist ein library-uebergreifendes Anzeige-Flag (kein Secret).
  // Wohnt unter der Story-/Galerie-Config (config.chat.gallery.showSdgProfile),
  // nicht in der Library-Storage-Config.
  const libraries = useLibraries()
  const sdgEnabled = libraries.find((l) => l.id === libraryId)?.config?.chat?.gallery?.showSdgProfile === true

  const bewertung = useBewertung(props)
  const { docMeta, isDocMetaReady, sessionUrl, sdgDocMeta } = useDocMeta({ open, libraryId, fileId, viewType, locale, fallbackLocale, instanz })

  // D7: Sprung auf die Seite aus der Adresse, sobald der Inhalt da ist
  const inhaltRef = React.useRef<HTMLDivElement>(null)
  useSeitenSprung(page, inhaltRef, isDocMetaReady)

  // Ref auf die Kommentar-Sektion, damit der Header-Button dorthin scrollt.
  const commentsRef = React.useRef<HTMLDivElement | null>(null)
  const scrollToComments = React.useCallback(() => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Display-Title (i18n)
  const displayTitle = (() => {
    if (title) return title
    switch (viewType) {
      case 'session': return t('gallery.talkSummary')
      case 'climateAction': return t('gallery.climateActionView', { defaultValue: 'Maßnahmendetails' })
      default: return t('gallery.documentView')
    }
  })()

  // Kommentar-Sektion (eine Instanz). Position haengt vom Modus ab:
  // im Bewertungsmodus oben (schnell kommentieren vor "Wichtig & weiter"),
  // sonst unten unter den Infos. Der Debug-Block der Detail-Komponenten ist
  // dev-only und in Produktion nicht vorhanden.
  const commentsBlock =
    isSignedIn && fileId ? (
      <div ref={commentsRef} className='border-t p-6 space-y-3'>
        <h3 className='text-sm font-semibold'>
          {t('gallery.comments.sectionTitle', { defaultValue: 'Kommentare' })}
        </h3>
        <SourceCommentsPanel libraryId={libraryId} fileId={fileId} open={open} />
      </div>
    ) : null

  if (!open) return null
  return (
    <div className='fixed inset-0 z-[60]'>
      <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={onClose} />
      <div
        className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <DetailKopf
          libraryId={libraryId}
          fileId={fileId}
          viewType={viewType}
          doc={props.doc}
          storyModusVerfuegbar={props.storyModusVerfuegbar}
          currentMode={props.currentMode}
          isSwitchingRef={props.isSwitchingRef}
          siblingDocs={props.siblingDocs}
          onNavigateToDoc={props.onNavigateToDoc}
          onClose={onClose}
          displayTitle={displayTitle}
          isMember={isMember}
          isSignedIn={isSignedIn}
          sessionUrl={sessionUrl}
          bewertung={bewertung}
          onScrollToComments={scrollToComments}
        />

        {/* Radix legt unter dem Viewport ein display:table-Element an, das sich
            an der Max-Content-Breite des Inhalts ausrichtet. Auf schmalen
            Rahmen (Mobil, Embed) wuchs die Buch-Ansicht damit ueber das Panel
            hinaus und wurde rechts abgeschnitten. Block + min-w-0 stellt das
            normale Umbruchverhalten her (gleiches Muster wie in gallery-root). */}
        <ScrollArea
          ref={inhaltRef}
          className='flex-1 w-full overflow-hidden relative'
          viewportClassName='[&>div]:!block [&>div]:!min-w-0 [&>div]:w-full'
        >
          <DetailBody
            viewType={viewType}
            renderers={detailRenderers}
            libraryId={libraryId}
            fileId={fileId}
            docMeta={docMeta}
            isDocMetaReady={isDocMetaReady}
            fallbackLocale={fallbackLocale}
            sdgEnabled={sdgEnabled}
            sdgDocMeta={sdgDocMeta}
            kommentare={commentsBlock}
            ratingActive={bewertung.ratingActive}
          />
        </ScrollArea>
      </div>
    </div>
  )
}
