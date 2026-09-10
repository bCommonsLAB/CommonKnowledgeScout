'use client'

import React from 'react'
import { Button, ScrollArea } from '@ks/ui'
import { X, ExternalLink, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { useUserStates } from '../hooks/use-user-states'
import { findDocMetaByFileId } from '../lib/apply-favorite-optimistic'
import { useLibraryRole } from '../hooks/use-library-role'
import { useTinderSequencer } from '../hooks/use-tinder-sequencer'
import type { DetailViewType } from '@ks/contracts'
import { SourceStarsCell } from './source-stars-cell'
import { RatingModeBar } from './rating/rating-mode-bar'
import { SourceCommentsPanel } from './source-comments-panel'
import { useTranslation } from '@ks/i18n/react'
import { useLibraries } from '@ks/shell/react'
import { SdgProfile } from './sdg-profile'
import { extractSdgValues, extractSdgBegruendung, hasSdgData } from '@ks/util'
import { SwitchToStoryModeButton } from './switch-to-story-mode-button'
import { DocumentShareButton } from './document-share-button'
import type { DocCardMeta } from '../lib/types'
import { localizeDocMetaJson } from '../../doc-meta/get-localized'
import { useInstanz } from '../contexts/gallery-host-context'

/** Was ein Renderer braucht, um eine Detailansicht zu bauen. */
export interface DetailRenderProps {
  libraryId: string
  fileId: string
  /**
   * Die Antwort von `/doc-meta`, `docMetaJson` bereits mit der aktiven Locale
   * veredelt — `null`, solange sie laedt oder wenn es keine gab. Der Renderer
   * mappt sie selbst in seine Form; die Galerie kennt die Formen nicht.
   */
  docMeta: Record<string, unknown> | null
  /** `true`, sobald der Doc-Meta-Abruf abgeschlossen ist — auch ohne Ergebnis. */
  isDocMetaReady: boolean
  fallbackLocale?: string
}

/**
 * Eine Detailansicht als Komponente. Bewusst keine blosse Funktion: Renderer
 * duerfen Hooks nutzen (die Buch- und Session-Ansicht memoisieren ihr
 * Mapping, weil `initialData` dort in einem Effekt haengt).
 */
export type DetailRenderer = React.ComponentType<DetailRenderProps>

export interface DetailOverlayProps {
  open: boolean
  onClose: () => void
  libraryId: string
  fileId: string
  /** Typ der Detailansicht — Werteliste aus der zentralen Registry */
  viewType: DetailViewType
  /**
   * Welche Ansicht zu welchem Typ gehoert. Kommt vom Montagepunkt (M4g): Die
   * Galerie kennt die zehn Detail-Komponenten der App nicht mehr. Der
   * `Record` haelt die Typgrenze — ein neuer `detailViewType` ist dort ein
   * Typfehler, bis er eine Ansicht hat.
   */
  detailRenderers: Record<DetailViewType, DetailRenderer>
  title?: string
  /** Optional: Dokument-Metadaten für den SwitchToStoryModeButton */
  doc?: DocCardMeta
  /**
   * Gibt es einen Story-Modus, in den der Knopf wechseln kann? Die App reicht
   * immer einen Story-Slot herein, das Embed nie (M5: Story und Chat bleiben
   * draussen). Ohne Slot fuehrte „In Story Mode ansehen" ins Leere.
   */
  storyModusVerfuegbar: boolean
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
  detailRenderers,
  title,
  doc,
  storyModusVerfuegbar,
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
  const instanz = useInstanz()
  // SDG-Profil ist ein library-uebergreifendes Anzeige-Flag (kein Secret).
  // Wohnt unter der Story-/Galerie-Config (config.chat.gallery.showSdgProfile),
  // nicht in der Library-Storage-Config.
  const libraries = useLibraries()
  const sdgEnabled = libraries.find((l) => l.id === libraryId)?.config?.chat?.gallery?.showSdgProfile === true
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

  // Ref auf die Kommentar-Sektion, damit der Header-Button dorthin scrollt.
  const commentsRef = React.useRef<HTMLDivElement | null>(null)
  const scrollToComments = React.useCallback(() => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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

  // Die Doc-Meta-Antwort, bereits sprach-veredelt. Das Mapping in die Form der
  // jeweiligen Ansicht macht der Renderer (M4g) — die Galerie kennt sie nicht.
  const [docMeta, setDocMeta] = React.useState<Record<string, unknown> | null>(null)
  const [isDocMetaReady, setIsDocMetaReady] = React.useState(false)
  const [sessionUrl, setSessionUrl] = React.useState<string | null>(null)
  // Lokalisiertes docMetaJson fuer das generische SDG-Profil (alle View-Typen).
  const [sdgDocMeta, setSdgDocMeta] = React.useState<Record<string, unknown> | null>(null)

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
      setDocMeta(null)
      setIsDocMetaReady(false)
      setSessionUrl(null)
      setSdgDocMeta(null)
      return
    }

    setDocMeta(null)
    setIsDocMetaReady(false)
    setSdgDocMeta(null)

    const loadDocMeta = async () => {
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
        // Keine eigene `x-locale`-Kopfzeile: Die Middleware setzt sie aus Cookie
        // bzw. `Accept-Language` selbst und ueberschreibt, was der Client schickt.
        // Von einer fremden Seite (Embed) kostete sie nur einen Preflight (Audit 03).
        const res = await instanz.fetch(url, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.docMetaJson) return

        const docMetaJson = json.docMetaJson as Record<string, unknown>
        // Locale-Veredelung VOR dem Detail-Mapping (das der Renderer macht)
        const localized = localizeDocMetaJson(docMetaJson, locale, fallbackLocale)
        setDocMeta({ ...(json as Record<string, unknown>), docMetaJson: localized })
        // Raw (lokalisiertes) docMetaJson fuer das generische SDG-Profil behalten.
        setSdgDocMeta(localized as Record<string, unknown>)

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
  }, [open, libraryId, fileId, viewType, locale, fallbackLocale, instanz])

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
              {/* Kommentar-Button: springt zur Kommentar-Sektion unten (mit Counter). */}
              {isSignedIn && fileId && (
                <Button
                  variant='ghost'
                  size='sm'
                  type='button'
                  onClick={(e) => { e.stopPropagation(); scrollToComments() }}
                  className='gap-1 text-xs'
                  title={t('gallery.comments.sectionTitle', { defaultValue: 'Kommentare' })}
                >
                  <MessageCircle className='h-4 w-4' aria-hidden />
                  {typeof starMeta?.commentCount === 'number' && starMeta.commentCount > 0 ? (
                    <span className='tabular-nums'>{starMeta.commentCount}</span>
                  ) : null}
                </Button>
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
                  {storyModusVerfuegbar ? (
                    <SwitchToStoryModeButton
                      doc={doc}
                      currentMode={currentMode}
                      onClose={onClose}
                      isSwitchingRef={isSwitchingRef}
                    />
                  ) : null}
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
          {/* Bewertungsmodus: Kommentare oben, direkt unter der Leiste. */}
          {ratingActive ? commentsBlock : null}
          <DetailBody
            viewType={viewType}
            renderers={detailRenderers}
            libraryId={libraryId}
            fileId={fileId}
            docMeta={docMeta}
            isDocMetaReady={isDocMetaReady}
            fallbackLocale={fallbackLocale}
          />
          {/* Generisches SDG-Profil (library-uebergreifend, flag-gesteuert):
              nur wenn aktiviert UND die SDG-Felder vorhanden sind. Fuer
              climateAction NICHT hier — die Klima-Detailansicht rendert das
              SDG-Rad selbst als Accordion-Abschnitt (nach der KI-Einschaetzung). */}
          {sdgEnabled && viewType !== 'climateAction' && sdgDocMeta && hasSdgData(sdgDocMeta) ? (
            <div className='px-6 pb-6'>
              <SdgProfile
                values={extractSdgValues(sdgDocMeta)}
                begruendung={extractSdgBegruendung(sdgDocMeta)}
              />
            </div>
          ) : null}
          {/* Normalmodus: Kommentare unten, unter den Infos. */}
          {!ratingActive ? commentsBlock : null}
        </ScrollArea>
      </div>
    </div>
  )
}

interface DetailBodyProps extends DetailRenderProps {
  viewType: DetailViewType
  renderers: Record<DetailViewType, DetailRenderer>
}

/**
 * Waehlt die Ansicht zum Typ. Die Tabelle selbst kommt vom Montagepunkt
 * (`gallery-detail-renderers.tsx` in der App, M4g); hier steht nur noch die
 * Auswahl — und der laute Fall fuer einen Typ, der der Tabelle fehlt.
 */
function DetailBody({ viewType, renderers, ...renderProps }: DetailBodyProps) {
  // Die Typgrenze deckt den Normalfall ab. Sollte ein ungeprueftes
  // detailViewType aus alter Library-Config doch durchkommen, wird das
  // ausdruecklich gemeldet statt still zur Buch-Ansicht zu werden.
  const Renderer = renderers[viewType]
  if (!Renderer) {
    console.error(`[DetailBody] Unbekannter detailViewType "${viewType}" — es wird die Buch-Ansicht gezeigt.`)
  }
  const Ansicht = Renderer ?? renderers.book
  return (
    <div className='p-0 w-full max-w-full overflow-x-hidden'>
      <Ansicht {...renderProps} />
    </div>
  )
}
