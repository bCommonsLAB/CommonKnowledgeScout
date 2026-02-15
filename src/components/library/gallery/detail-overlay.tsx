'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X, ExternalLink, Loader2 } from 'lucide-react'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { IngestionClimateActionDetail } from '@/components/library/ingestion-climate-action-detail'
import { IngestionDivaDocumentDetail } from '@/components/library/ingestion-diva-document-detail'
import type { ClimateActionDetailData } from '@/components/library/climate-action-detail'
import type { DivaDocumentDetailData } from '@/components/library/diva-document-detail'
import { useTranslation } from '@/lib/i18n/hooks'
import { useDocumentTranslation } from '@/hooks/use-document-translation'
import { SwitchToStoryModeButton } from '@/components/library/gallery/switch-to-story-mode-button'
import { DocumentShareButton } from '@/components/library/gallery/document-share-button'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface DetailOverlayProps {
  open: boolean
  onClose: () => void
  libraryId: string
  fileId: string
  /** Typ der Detailansicht (book, session, climateAction, testimonial, blog, divaDocument) */
  viewType: 'book' | 'session' | 'climateAction' | 'testimonial' | 'blog' | 'divaDocument'
  title?: string
  /** Optional: Dokument-Metadaten für den SwitchToStoryModeButton */
  doc?: DocCardMeta
  /** Optional: Aktueller Mode für den SwitchToStoryModeButton */
  currentMode?: 'gallery' | 'story'
  /** Optional: Ref für Flag, um zu verhindern, dass selectedDoc während des Wechsels verwendet wird */
  isSwitchingRef?: React.MutableRefObject<boolean>
}

// localStorage Key für globale Präferenz (gilt für alle Dokumente)
const PREFER_TRANSLATION_KEY = 'detail-view-prefer-translation'

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
}: DetailOverlayProps) {
  const { t, locale } = useTranslation()
  const { translateDocument, loading: translationLoading } = useDocumentTranslation()
  
  // viewType wird automatisch über Props verwaltet
  
  // State für Tab und Übersetzung
  // Hinweis: ClimateActionDetailData und DivaDocumentDetailData werden hier auch unterstützt
  const [activeTab, setActiveTab] = React.useState<'original' | 'translated'>('original')
  const [originalData, setOriginalData] = React.useState<BookDetailData | SessionDetailData | ClimateActionDetailData | DivaDocumentDetailData | null>(null)
  const [translatedData, setTranslatedData] = React.useState<BookDetailData | SessionDetailData | ClimateActionDetailData | DivaDocumentDetailData | null>(null)
  const [originalLanguage, setOriginalLanguage] = React.useState<string>('EN')
  const [sessionUrl, setSessionUrl] = React.useState<string | null>(null)
  
  // Bestimme Titel basierend auf viewType, falls nicht explizit angegeben
  const getDisplayTitle = () => {
    if (title) return title
    switch (viewType) {
      case 'session': return t('gallery.talkSummary')
      case 'climateAction': return t('gallery.climateActionView', { defaultValue: 'Maßnahmendetails' })
      default: return t('gallery.documentView')
    }
  }
  const displayTitle = getDisplayTitle()
  
  // Mapping von Locale zu Sprachcode (Großbuchstaben) für Übersetzungs-API
  // Unterstützt alle verfügbaren Zielsprachen
  const localeToLanguageCode: Record<string, string> = {
    de: 'DE',
    en: 'EN',
    it: 'IT',
    fr: 'FR',
    es: 'ES',
    pt: 'PT',
    nl: 'NL',
    no: 'NO',
    da: 'DA',
    sv: 'SV',
    fi: 'FI',
    pl: 'PL',
    cs: 'CS',
    hu: 'HU',
    ro: 'RO',
    bg: 'BG',
    el: 'EL',
    tr: 'TR',
    ru: 'RU',
    uk: 'UK',
    zh: 'ZH',
    ko: 'KO',
    ja: 'JA',
    hr: 'HR',
    sr: 'SR',
    bs: 'BS',
    sl: 'SL',
    sk: 'SK',
    lt: 'LT',
    lv: 'LV',
    et: 'ET',
    id: 'ID',
    ms: 'MS',
    hi: 'HI',
    sw: 'SW',
    yo: 'YO',
    zu: 'ZU',
  }
  const targetLanguageCode = localeToLanguageCode[locale] || 'DE'
  
  // Ref, um zu verhindern, dass Übersetzung mehrfach gestartet wird
  const translationStartedRef = React.useRef<string | null>(null)
  // Ref für handleDataLoaded, um Stabilität zu gewährleisten
  const handleDataLoadedRef = React.useRef<((data: BookDetailData | SessionDetailData) => void) | null>(null)
  
  // Callback für geladene Original-Daten
  // WICHTIG: originalLanguage NICHT in Dependencies, um Endlosschleifen zu vermeiden
  // Die Originalsprache wird aus den Daten selbst ermittelt
  const handleDataLoaded = React.useCallback((data: BookDetailData | SessionDetailData) => {
    const dataFileId = (data as { fileId?: string }).fileId || fileId
    const translationKey = `${dataFileId}-${targetLanguageCode}`
    
    // Verhindere mehrfache Aufrufe für dieselbe Übersetzung
    if (translationStartedRef.current === translationKey) {
      return
    }
    
    setOriginalData(data)
    
    // Originalsprache aus Daten ermitteln
    // Fallback: "EN" wenn nicht explizit bestimmt
    const dataLanguage = (data as { language?: string }).language
    const lang = typeof dataLanguage === 'string' && dataLanguage.trim().length > 0 
      ? dataLanguage.trim() 
      : 'EN'
    const langCode = lang.toUpperCase().slice(0, 2)
    
    // Setze Originalsprache mit funktionalem Update, um Race Conditions zu vermeiden
    setOriginalLanguage((prevLang) => {
      if (prevLang !== langCode) {
        return langCode
      }
      return prevLang
    })
    
    // KEINE automatische Übersetzung beim ersten Öffnen
    // Übersetzung wird nur gestartet, wenn:
    // 1. Benutzer manuell auf "translated" Tab klickt, ODER
    // 2. Präferenz existiert und Dokument geöffnet wird (siehe useEffect)
  }, [fileId, targetLanguageCode])
  
  // Aktualisiere Ref, damit IngestionSessionDetail immer die neueste Version hat
  React.useEffect(() => {
    handleDataLoadedRef.current = handleDataLoaded
  }, [handleDataLoaded])
  
  // Tab-Wechsel Handler
  const handleTabChange = React.useCallback((value: string) => {
    if (value === 'translated') {
      // Benutzer wechselt zu Übersetzung: Speichere Präferenz global
      if (typeof window !== 'undefined') {
        localStorage.setItem(PREFER_TRANSLATION_KEY, 'true')
      }
      
      // Übersetzung laden, wenn noch nicht vorhanden
      if (!translatedData && originalData) {
        const translationKey = `${fileId}-${targetLanguageCode}`
        translationStartedRef.current = translationKey
        
        translateDocument({
          libraryId,
          fileId,
          viewType,
        }).then((result) => {
          if (result?.translatedData) {
            setTranslatedData(result.translatedData)
            setActiveTab('translated')
          }
        }).catch((err) => {
          console.error('[DetailOverlay] Übersetzungsfehler beim Tab-Wechsel:', err)
          translationStartedRef.current = null
        })
      } else {
        // Übersetzung bereits vorhanden, einfach Tab wechseln
        setActiveTab('translated')
      }
    } else {
      // Benutzer wechselt zu Original: Lösche Präferenz (Benutzer bevorzugt Original)
      if (typeof window !== 'undefined') {
        localStorage.removeItem(PREFER_TRANSLATION_KEY)
      }
      setActiveTab('original')
    }
  }, [translatedData, originalData, libraryId, fileId, viewType, translateDocument, targetLanguageCode])
  
  // Lade Originalsprache beim Öffnen der Overlay
  // Prüfe auch localStorage-Präferenz und setze entsprechenden Tab
  React.useEffect(() => {
    if (!open) {
      setActiveTab('original')
      setOriginalData(null)
      setTranslatedData(null)
      setSessionUrl(null)
      setOriginalLanguage('EN')
      translationStartedRef.current = null // Reset translation flag
      return
    }

    // Prüfe globale localStorage-Präferenz beim Öffnen
    const preferTranslation = typeof window !== 'undefined' 
      ? localStorage.getItem(PREFER_TRANSLATION_KEY) === 'true'
      : false

    // Lade doc-meta, um Originalsprache zu ermitteln
    const loadLanguage = async () => {
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
        const res = await fetch(url, { cache: 'no-store' })
        const json = await res.json()
        
        if (res.ok && json.docMetaJson) {
          const docMetaJson = json.docMetaJson as Record<string, unknown>
          
          // Bestimme Originalsprache
          const languageField = docMetaJson.language
          const lang = typeof languageField === 'string' && languageField.trim().length > 0
            ? languageField.trim()
            : 'EN'
          const langCode = lang.toUpperCase().slice(0, 2)
          
          setOriginalLanguage(langCode)
          
          // URL für Sessions speichern
          if (viewType === 'session' && typeof docMetaJson.url === 'string') {
            setSessionUrl(docMetaJson.url)
          }
          
          // Wenn Präferenz existiert UND Übersetzung nötig ist: automatisch auf "translated" Tab wechseln
          if (preferTranslation && langCode !== targetLanguageCode) {
            setActiveTab('translated')
          }
        } else {
          // Fallback: "EN" wenn doc-meta nicht verfügbar ist
          setOriginalLanguage('EN')
        }
      } catch (err) {
        console.error('[DetailOverlay] ❌ Fehler beim Laden der Originalsprache:', {
          error: err,
          message: err instanceof Error ? err.message : String(err),
        })
        // Fallback: "EN" bei Fehler
        setOriginalLanguage('EN')
      }
    }

    void loadLanguage()
  }, [open, libraryId, fileId, viewType, targetLanguageCode])
  
  // Starte automatische Übersetzung, wenn Präferenz gesetzt ist und originalData vorhanden ist
  React.useEffect(() => {
    if (!open || !originalData) return
    
    // Prüfe Präferenz
    const preferTranslation = typeof window !== 'undefined' 
      ? localStorage.getItem(PREFER_TRANSLATION_KEY) === 'true'
      : false
    
    // Prüfe, ob Übersetzung nötig ist
    const needsTranslation = originalLanguage !== targetLanguageCode
    
    // Prüfe, ob wir auf "translated" Tab sind (kann durch Präferenz gesetzt worden sein)
    const isTranslatedTab = activeTab === 'translated'
    
    // Starte Übersetzung nur wenn:
    // 1. Präferenz gesetzt ist UND
    // 2. Übersetzung nötig ist UND
    // 3. Wir auf "translated" Tab sind UND
    // 4. Übersetzung noch nicht vorhanden ist UND
    // 5. Übersetzung noch nicht gestartet wurde
    if (preferTranslation && needsTranslation && isTranslatedTab && !translatedData) {
      const translationKey = `${fileId}-${targetLanguageCode}`
      
      // Verhindere mehrfache Aufrufe
      if (translationStartedRef.current === translationKey) {
        return
      }
      
      translationStartedRef.current = translationKey
      
      translateDocument({
        libraryId,
        fileId,
        viewType,
      }).then((result) => {
        if (result?.translatedData) {
          setTranslatedData(result.translatedData)
        }
      }).catch((err) => {
        console.error('[DetailOverlay] ❌ Übersetzungsfehler (Präferenz):', err)
        translationStartedRef.current = null
      })
    }
  }, [open, originalData, originalLanguage, targetLanguageCode, activeTab, translatedData, fileId, viewType, libraryId, translateDocument])
  
  // viewType wird automatisch über Props verwaltet
  
  // Prüfe, ob Tabs angezeigt werden sollen (nur wenn Originalsprache != Zielsprache)
  const shouldShowTabs = originalLanguage !== targetLanguageCode
  
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
              {/* Link zur Original-Webseite (nur für Sessions mit URL) */}
              {viewType === 'session' && sessionUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-xs"
                >
                  <a
                    href={sessionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>{t('gallery.linkToOriginalWebsite')}</span>
                  </a>
                </Button>
              )}
              <Button variant='ghost' size='icon' onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
          
          {/* Tabs und CTA-Button nebeneinander */}
          <div className="flex items-center justify-between gap-4">
            {/* Tabs für Sprache (nur wenn Originalsprache != Zielsprache) */}
            {shouldShowTabs && (
              <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
                <TabsList className="w-fit">
                  <TabsTrigger value="original">{originalLanguage}</TabsTrigger>
                  <TabsTrigger value="translated" disabled={translationLoading && !translatedData}>
                    {translationLoading && !translatedData ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {targetLanguageCode}
                      </span>
                    ) : (
                      targetLanguageCode
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            
            {/* Share-Button und CTA-Button für Story Mode */}
            {doc && (
              <div className="flex items-center gap-2 shrink-0">
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
        </div>
        <ScrollArea className='flex-1 w-full overflow-hidden relative'>
          <div className={`p-0 w-full max-w-full overflow-x-hidden transition-opacity duration-300 ${
            translationLoading && !translatedData ? 'opacity-70' : 'opacity-100'
          }`}>
            {/* Render Detail-Komponente basierend auf viewType */}
            {viewType === 'session' && (
              <IngestionSessionDetail
                libraryId={libraryId}
                fileId={fileId}
                onDataLoaded={(data) => {
                  // Verwende Ref, um sicherzustellen, dass wir die neueste Version verwenden
                  // aber vermeide, dass sich der Callback ändert und zu Re-Renders führt
                  if (handleDataLoadedRef.current) {
                    handleDataLoadedRef.current(data)
                  }
                }}
                translatedData={activeTab === 'translated' ? (translatedData as SessionDetailData) : undefined}
              />
            )}
            {viewType === 'climateAction' && (
              <IngestionClimateActionDetail
                libraryId={libraryId}
                fileId={fileId}
                onDataLoaded={(data) => {
                  if (handleDataLoadedRef.current) {
                    handleDataLoadedRef.current(data)
                  }
                }}
                translatedData={activeTab === 'translated' ? (translatedData as ClimateActionDetailData) : undefined}
              />
            )}
            {viewType === 'divaDocument' && (
              <IngestionDivaDocumentDetail
                libraryId={libraryId}
                fileId={fileId}
                onDataLoaded={(data) => {
                  if (handleDataLoadedRef.current) {
                    handleDataLoadedRef.current(data)
                  }
                }}
                translatedData={activeTab === 'translated' ? (translatedData as DivaDocumentDetailData) : undefined}
              />
            )}
            {/* Default: Book-Detail (auch für testimonial, blog - vorerst) */}
            {viewType !== 'session' && viewType !== 'climateAction' && viewType !== 'divaDocument' && (
              <IngestionBookDetail
                libraryId={libraryId}
                fileId={fileId}
                translatedData={activeTab === 'translated' ? (translatedData as BookDetailData) : undefined}
              />
            )}
          </div>
          {/* Overlay während Übersetzung: Weißblende mit Ladebalken */}
          {/* Zeige Overlay, wenn Übersetzung läuft und noch keine übersetzten Daten vorhanden sind */}
          {translationLoading && !translatedData && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">
                  {t('gallery.translationGenerating')}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}


