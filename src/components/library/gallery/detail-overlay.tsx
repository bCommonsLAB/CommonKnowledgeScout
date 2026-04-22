'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, ExternalLink } from 'lucide-react'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { IngestionClimateActionDetail } from '@/components/library/ingestion-climate-action-detail'
import { IngestionDivaDocumentDetail } from '@/components/library/ingestion-diva-document-detail'
import { IngestionDivaTextureDetail } from '@/components/library/ingestion-diva-texture-detail'
import { useTranslation } from '@/lib/i18n/hooks'
import { SwitchToStoryModeButton } from '@/components/library/gallery/switch-to-story-mode-button'
import { DocumentShareButton } from '@/components/library/gallery/document-share-button'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'
import type { DocCardMeta } from '@/lib/gallery/types'
import { mapToBookDetail, mapToSessionDetail } from '@/lib/mappers/doc-meta-mappers'
import { localizeDocMetaJson } from '@/lib/i18n/get-localized'

export interface DetailOverlayProps {
  open: boolean
  onClose: () => void
  libraryId: string
  fileId: string
  /** Typ der Detailansicht (book, session, climateAction, testimonial, blog, divaDocument, divaTexture) */
  viewType: 'book' | 'session' | 'climateAction' | 'testimonial' | 'blog' | 'divaDocument' | 'divaTexture'
  title?: string
  /** Optional: Dokument-Metadaten für den SwitchToStoryModeButton */
  doc?: DocCardMeta
  /** Optional: Aktueller Mode für den SwitchToStoryModeButton */
  currentMode?: 'gallery' | 'story'
  /** Optional: Ref für Flag, um zu verhindern, dass selectedDoc während des Wechsels verwendet wird */
  isSwitchingRef?: React.MutableRefObject<boolean>
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string
}

/**
 * DetailOverlay – Anzeige eines Dokuments im Slide-In.
 *
 * Refactor (Doc-Translations):
 *   - Lokaler Sprachswitch (Tabs) entfernt; die Anzeige folgt jetzt dem
 *     globalen `LanguageSwitcher` (`useTranslation().locale`).
 *   - Bei Bedarf werden die geladenen `docMetaJson`-Felder via
 *     `localizeDocMetaJson()` mit `translations.detail.<locale>` (Fallback
 *     `<fallbackLocale>` und Original) ueberlagert, BEVOR die Detail-Mapper
 *     greifen. So bleiben die Mapper sprachneutral.
 *   - Wenn keine Uebersetzung vorhanden ist, faellt die Anzeige sauber auf
 *     die Originalsprache zurueck (siehe `getLocalized`-Fallback-Kette).
 */
export function DetailOverlay({
  open,
  onClose,
  libraryId,
  fileId,
  viewType,
  title,
  doc,
  currentMode = 'gallery',
  isSwitchingRef,
  fallbackLocale,
}: DetailOverlayProps) {
  const { t, locale } = useTranslation()

  // Vorgemappte Detail-Daten (durch doc-meta Prefetch), bereits sprach-veredelt.
  const [prefetchedBookData, setPrefetchedBookData] = React.useState<BookDetailData | null>(null)
  const [prefetchedSessionData, setPrefetchedSessionData] = React.useState<SessionDetailData | null>(null)
  const [isDocMetaReady, setIsDocMetaReady] = React.useState(false)
  const [sessionUrl, setSessionUrl] = React.useState<string | null>(null)

  // Display-Title (i18n)
  const getDisplayTitle = () => {
    if (title) return title
    switch (viewType) {
      case 'session': return t('gallery.talkSummary')
      case 'climateAction': return t('gallery.climateActionView', { defaultValue: 'Maßnahmendetails' })
      default: return t('gallery.documentView')
    }
  }
  const displayTitle = getDisplayTitle()

  // Prefetch der Doc-Meta beim Oeffnen / Doc- oder Locale-Wechsel.
  // Wir veredeln docMetaJson direkt mit der aktiven Locale, damit das Mapping
  // in der Originalsprache landet, falls keine Translation existiert.
  React.useEffect(() => {
    if (!open) {
      setPrefetchedBookData(null)
      setPrefetchedSessionData(null)
      setIsDocMetaReady(false)
      setSessionUrl(null)
      return
    }

    setPrefetchedBookData(null)
    setPrefetchedSessionData(null)
    setIsDocMetaReady(false)

    const loadDocMeta = async () => {
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
        // x-locale Header sorgt server-seitig fuer locale-spezifische Projection
        const res = await fetch(url, { cache: 'no-store', headers: { 'x-locale': locale } })
        const json = await res.json()
        if (!res.ok || !json?.docMetaJson) return

        const docMetaJson = json.docMetaJson as Record<string, unknown>
        // Locale-Veredelung VOR dem Detail-Mapping
        const localized = localizeDocMetaJson(docMetaJson, locale, fallbackLocale)
        const localizedJson = { ...json, docMetaJson: localized }

        if (viewType === 'session') {
          try { setPrefetchedSessionData(mapToSessionDetail(localizedJson as unknown)) } catch { setPrefetchedSessionData(null) }
        } else if (viewType !== 'climateAction' && viewType !== 'divaDocument' && viewType !== 'divaTexture') {
          try { setPrefetchedBookData(mapToBookDetail(localizedJson as unknown)) } catch { setPrefetchedBookData(null) }
        }

        // URL fuer Sessions speichern (oben rechts „Original"-Link)
        if (viewType === 'session' && typeof docMetaJson.url === 'string') {
          setSessionUrl(docMetaJson.url)
        }
      } catch (err) {
        console.error('[DetailOverlay] Fehler beim Laden der Doc-Meta:', err)
      } finally {
        setIsDocMetaReady(true)
      }
    }

    void loadDocMeta()
  }, [open, libraryId, fileId, viewType, locale, fallbackLocale])

  if (!open) return null
  return (
    <div className='fixed inset-0 z-[60]'>
      <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={onClose} />
      <div
        className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex flex-col gap-3 p-6 border-b shrink-0'>
          <div className='flex items-center justify-between gap-4'>
            <h2 className='text-xl font-semibold'>{displayTitle}</h2>
            <div className='flex items-center gap-2 shrink-0'>
              {/* Link zur Original-Webseite (nur fuer Sessions mit URL) */}
              {viewType === 'session' && sessionUrl && (
                <Button variant='ghost' size='sm' asChild className='text-xs'>
                  <a href={sessionUrl} target='_blank' rel='noopener noreferrer' className='flex items-center gap-1'>
                    <ExternalLink className='h-3 w-3' />
                    <span>{t('gallery.linkToOriginalWebsite')}</span>
                  </a>
                </Button>
              )}
              <Button variant='ghost' size='icon' onClick={(e) => { e.stopPropagation(); onClose() }}>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {/* Share-Button + Story-Mode-Button (Tabs entfernt – globaler LanguageSwitcher) */}
          {doc && (
            <div className='flex items-center justify-end gap-2'>
              <DocumentShareButton doc={doc} title={displayTitle} />
              <SwitchToStoryModeButton
                doc={doc}
                currentMode={currentMode}
                onClose={onClose}
                isSwitchingRef={isSwitchingRef}
              />
            </div>
          )}
        </div>

        <ScrollArea className='flex-1 w-full overflow-hidden relative'>
          <div className='p-0 w-full max-w-full overflow-x-hidden'>
            {viewType === 'session' && (
              <IngestionSessionDetail
                libraryId={libraryId}
                fileId={fileId}
                initialData={prefetchedSessionData || undefined}
                suspendInitialFetch={!isDocMetaReady}
                fallbackLocale={fallbackLocale}
              />
            )}
            {viewType === 'climateAction' && (
              <IngestionClimateActionDetail
                libraryId={libraryId}
                fileId={fileId}
                fallbackLocale={fallbackLocale}
              />
            )}
            {viewType === 'divaDocument' && (
              <IngestionDivaDocumentDetail
                libraryId={libraryId}
                fileId={fileId}
                fallbackLocale={fallbackLocale}
              />
            )}
            {viewType === 'divaTexture' && (
              <IngestionDivaTextureDetail
                libraryId={libraryId}
                fileId={fileId}
              />
            )}
            {/* Default: Book-Detail (auch fuer testimonial, blog – vorerst) */}
            {viewType !== 'session' && viewType !== 'climateAction' && viewType !== 'divaDocument' && viewType !== 'divaTexture' && (
              <IngestionBookDetail
                libraryId={libraryId}
                fileId={fileId}
                initialData={prefetchedBookData || undefined}
                suspendInitialFetch={!isDocMetaReady}
                fallbackLocale={fallbackLocale}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
