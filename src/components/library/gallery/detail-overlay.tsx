'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUserStates } from '@/hooks/gallery/use-user-states'
import { findDocMetaByFileId } from '@/lib/gallery/apply-favorite-optimistic'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useTinderSequencer } from '@/hooks/gallery/use-tinder-sequencer'
import { SourceStarsCell } from './source-stars-cell'
import { RatingModeBar } from './rating/rating-mode-bar'
import { SourceCommentsPanel } from './source-comments-panel'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { IngestionClimateActionDetail } from '@/components/library/ingestion-climate-action-detail'
import { IngestionDivaDocumentDetail } from '@/components/library/ingestion-diva-document-detail'
import { IngestionDivaTextureDetail } from '@/components/library/ingestion-diva-texture-detail'
import { IngestionRefurbedDeviceDetail } from '@/components/library/ingestion-refurbed-device-detail'
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
  /** Typ der Detailansicht (book, session, climateAction, testimonial, blog, divaDocument, divaTexture, refurbedDevice) */
  viewType: 'book' | 'session' | 'climateAction' | 'testimonial' | 'blog' | 'divaDocument' | 'divaTexture' | 'refurbedDevice'
  title?: string
  /** Optional: Dokument-Metadaten für den SwitchToStoryModeButton */
  doc?: DocCardMeta
  /** Optional: Aktueller Mode für den SwitchToStoryModeButton */
  currentMode?: 'gallery' | 'story'
  /** Optional: Ref für Flag, um zu verhindern, dass selectedDoc während des Wechsels verwendet wird */
  isSwitchingRef?: React.MutableRefObject<boolean>
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string
  /** Vorheriges Dokument (fuer Pfeil-Navigation links). */
  prevDoc?: DocCardMeta | null
  /** Naechstes Dokument (fuer Pfeil-Navigation rechts). */
  nextDoc?: DocCardMeta | null
  /** Callback: navigiere zu einem benachbarten Dokument. */
  onNavigateToDoc?: (doc: DocCardMeta) => void
  /**
   * Vollstaendige Geschwister-Liste (in der Reihenfolge der Galerie).
   * Wird vom Tinder-Sequencer genutzt, um nach `not_important` / `favorite`
   * einzuschraenken und unbewertete Quellen einzeln durchzugehen.
   */
  siblingDocs?: DocCardMeta[]
  /**
   * Stern togglen (optimistischer Patch + POST), wie in der Galerie.
   */
  onToggleFavorite?: (fileId: string) => void | Promise<void>
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
  prevDoc,
  nextDoc,
  onNavigateToDoc,
  siblingDocs,
  onToggleFavorite,
}: DetailOverlayProps) {
  const { t, locale } = useTranslation()
  const { isMember, isSignedIn } = useLibraryRole(libraryId)
  // Sichtbare/relevante fileIds: aktuelle Quelle + Geschwister fuer
  // den Tinder-Modus (sonst kann der Sequencer nicht filtern, was
  // bewertet wurde). Bei geschlossenem Overlay ist das Array leer.
  const visibleFileIds = React.useMemo(() => {
    const ids = new Set<string>()
    if (fileId) ids.add(fileId)
    if (Array.isArray(siblingDocs)) {
      for (const d of siblingDocs) {
        if (d.fileId) ids.add(d.fileId)
      }
    }
    return Array.from(ids)
  }, [fileId, siblingDocs])
  const { isNotImportant, setState: setUserState } = useUserStates(libraryId, visibleFileIds)

  const isFavoriteForSequencer = React.useCallback(
    (id: string) => findDocMetaByFileId(doc, id, siblingDocs)?.isFavorite === true,
    [doc, siblingDocs],
  )

  const handleToggleFavorite = React.useCallback(
    async (id: string) => {
      if (onToggleFavorite) {
        await onToggleFavorite(id)
        return
      }
      const meta = findDocMetaByFileId(doc, id, siblingDocs)
      const next = !(meta?.isFavorite === true)
      await setUserState(id, next ? 'favorite' : null)
    },
    [onToggleFavorite, doc, siblingDocs, setUserState],
  )

  const starMeta = findDocMetaByFileId(doc, fileId, siblingDocs)

  // Bewertungsmodus: lokaler State (kein URL-Param, weil die Detail-Overlay
  // an `?doc=` haengt und den Mode ohnehin nicht ueberlebt).
  const [ratingActive, setRatingActive] = React.useState(false)
  const [onlyUnrated, setOnlyUnrated] = React.useState(true)
  const sequencer = useTinderSequencer({
    docs: siblingDocs ?? [],
    currentFileId: fileId,
    isFavorite: isFavoriteForSequencer,
    isNotImportant,
    onlyUnrated: ratingActive && onlyUnrated,
  })

  // "Wichtig & weiter": favorisiert die aktuelle Quelle (sofern noch nicht)
  // und springt zur naechsten Quelle der Sequenz.
  const handleRateImportant = React.useCallback(async () => {
    if (!fileId) return
    const meta = findDocMetaByFileId(doc, fileId, siblingDocs)
    if (meta?.isFavorite !== true) {
      if (onToggleFavorite) await onToggleFavorite(fileId)
      else await setUserState(fileId, 'favorite')
    }
    if (sequencer.nextDoc && onNavigateToDoc) onNavigateToDoc(sequencer.nextDoc)
  }, [fileId, doc, siblingDocs, onToggleFavorite, setUserState, sequencer.nextDoc, onNavigateToDoc])

  // "Nicht wichtig & weiter": markiert privat als nicht wichtig und springt weiter.
  const handleRateNotImportant = React.useCallback(async () => {
    if (!fileId) return
    await setUserState(fileId, 'not_important')
    if (sequencer.nextDoc && onNavigateToDoc) onNavigateToDoc(sequencer.nextDoc)
  }, [fileId, setUserState, sequencer.nextDoc, onNavigateToDoc])

  // Pfeile im Bewertungsmodus folgen der gefilterten Sequenz, sonst der vom
  // Aufrufer durchgereichten Liste.
  const effectivePrevDoc = ratingActive ? sequencer.prevDoc : prevDoc ?? null
  const effectiveNextDoc = ratingActive ? sequencer.nextDoc : nextDoc ?? null

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
        } else if (viewType !== 'climateAction' && viewType !== 'divaDocument' && viewType !== 'divaTexture' && viewType !== 'refurbedDevice') {
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
            <div className='flex items-center gap-2 min-w-0 flex-1'>
              {/* Pfeil-Navigation: vorheriges Dokument */}
              {onNavigateToDoc && (
                <Button
                  variant='ghost'
                  size='icon'
                  type='button'
                  disabled={!effectivePrevDoc}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (effectivePrevDoc) onNavigateToDoc(effectivePrevDoc)
                  }}
                  aria-label={t('gallery.detail.previous', { defaultValue: 'Vorheriges Dokument' })}
                  title={effectivePrevDoc?.shortTitle || effectivePrevDoc?.title || effectivePrevDoc?.fileName}
                >
                  <ChevronLeft className='h-4 w-4' />
                </Button>
              )}
              <h2 className='text-xl font-semibold truncate'>{displayTitle}</h2>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {/* Sterne-Cell: eigener Stern + Counter + Tooltip (Member-only). */}
              {isMember && fileId && (
                <SourceStarsCell
                  libraryId={libraryId}
                  fileId={fileId}
                  isFavorite={starMeta?.isFavorite === true}
                  count={starMeta?.favoriteCount ?? 0}
                  voters={starMeta?.favoriteVoters ?? []}
                  onToggleFavorite={handleToggleFavorite}
                  size='md'
                />
              )}
              {/* Link zur Original-Webseite (nur fuer Sessions mit URL) */}
              {viewType === 'session' && sessionUrl && (
                <Button variant='ghost' size='sm' asChild className='text-xs'>
                  <a href={sessionUrl} target='_blank' rel='noopener noreferrer' className='flex items-center gap-1'>
                    <ExternalLink className='h-3 w-3' />
                    <span>{t('gallery.linkToOriginalWebsite')}</span>
                  </a>
                </Button>
              )}
              {/* Pfeil-Navigation: naechstes Dokument */}
              {onNavigateToDoc && (
                <Button
                  variant='ghost'
                  size='icon'
                  type='button'
                  disabled={!effectiveNextDoc}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (effectiveNextDoc) onNavigateToDoc(effectiveNextDoc)
                  }}
                  aria-label={t('gallery.detail.next', { defaultValue: 'Naechstes Dokument' })}
                  title={effectiveNextDoc?.shortTitle || effectiveNextDoc?.title || effectiveNextDoc?.fileName}
                >
                  <ChevronRight className='h-4 w-4' />
                </Button>
              )}
              <Button variant='ghost' size='icon' onClick={(e) => { e.stopPropagation(); onClose() }}>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>

          {/* Share + Story-Mode (rechts) und darunter der Bewertungsmodus. */}
          {doc && (
            <div className='flex flex-col gap-2'>
              <div className='flex items-center gap-2 flex-wrap'>
                <div className='ml-auto flex items-center gap-2'>
                  <DocumentShareButton doc={doc} title={displayTitle} />
                  <SwitchToStoryModeButton
                    doc={doc}
                    currentMode={currentMode}
                    onClose={onClose}
                    isSwitchingRef={isSwitchingRef}
                  />
                </div>
              </div>
              {/* Bewertungsmodus ist Member-only und braucht eine Geschwister-
                  Liste, sonst macht das Durchgehen keinen Sinn. */}
              {isMember && Array.isArray(siblingDocs) && siblingDocs.length > 1 ? (
                <RatingModeBar
                  active={ratingActive}
                  onChange={setRatingActive}
                  onlyUnrated={onlyUnrated}
                  onChangeOnlyUnrated={setOnlyUnrated}
                  total={sequencer.total}
                  index={sequencer.index}
                  unratedCount={sequencer.unratedCount}
                  favoriteCount={sequencer.favoriteCount}
                  notImportantCount={sequencer.notImportantCount}
                  onRateImportant={handleRateImportant}
                  onRateNotImportant={handleRateNotImportant}
                  isCurrentFavorite={starMeta?.isFavorite === true}
                  isCurrentNotImportant={fileId ? isNotImportant(fileId) : false}
                  disabled={!fileId}
                />
              ) : null}
            </div>
          )}
        </div>

        <ScrollArea className='flex-1 w-full overflow-hidden relative'>
          <DetailBody
            viewType={viewType}
            libraryId={libraryId}
            fileId={fileId}
            prefetchedSessionData={prefetchedSessionData}
            prefetchedBookData={prefetchedBookData}
            isDocMetaReady={isDocMetaReady}
            fallbackLocale={fallbackLocale}
          />
          {/* Kommentare: sehen + selbst schreiben (Sichtbarkeit/Rollen im Panel). */}
          {isSignedIn && fileId ? (
            <div className='border-t p-6 space-y-3'>
              <h3 className='text-sm font-semibold'>
                {t('gallery.comments.sectionTitle', { defaultValue: 'Kommentare' })}
              </h3>
              <SourceCommentsPanel libraryId={libraryId} fileId={fileId} open={open} />
            </div>
          ) : null}
        </ScrollArea>
      </div>
    </div>
  )
}

interface DetailBodyProps {
  viewType: DetailOverlayProps['viewType']
  libraryId: string
  fileId: string
  prefetchedSessionData: SessionDetailData | null
  prefetchedBookData: BookDetailData | null
  isDocMetaReady: boolean
  fallbackLocale?: string
}

function DetailBody({
  viewType,
  libraryId,
  fileId,
  prefetchedSessionData,
  prefetchedBookData,
  isDocMetaReady,
  fallbackLocale,
}: DetailBodyProps) {
  return (
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
        <IngestionClimateActionDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
      )}
      {viewType === 'divaDocument' && (
        <IngestionDivaDocumentDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
      )}
      {viewType === 'divaTexture' && (
        <IngestionDivaTextureDetail libraryId={libraryId} fileId={fileId} />
      )}
      {viewType === 'refurbedDevice' && (
        <IngestionRefurbedDeviceDetail libraryId={libraryId} fileId={fileId} fallbackLocale={fallbackLocale} />
      )}
      {viewType !== 'session' &&
        viewType !== 'climateAction' &&
        viewType !== 'divaDocument' &&
        viewType !== 'divaTexture' &&
        viewType !== 'refurbedDevice' && (
          <IngestionBookDetail
            libraryId={libraryId}
            fileId={fileId}
            initialData={prefetchedBookData || undefined}
            suspendInitialFetch={!isDocMetaReady}
            fallbackLocale={fallbackLocale}
          />
        )}
    </div>
  )
}
