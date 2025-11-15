'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X, MessageCircle, ArrowRight, ExternalLink, Loader2 } from 'lucide-react'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { useTranslation } from '@/lib/i18n/hooks'
import { useDocumentTranslation } from '@/hooks/use-document-translation'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'

export interface DetailOverlayProps {
  open: boolean
  onClose: () => void
  libraryId: string
  fileId: string
  viewType: 'book' | 'session'
  title?: string
  onSwitchToStoryMode?: () => void
}

// localStorage Key für globale Präferenz (gilt für alle Dokumente)
const PREFER_TRANSLATION_KEY = 'detail-view-prefer-translation'

export function DetailOverlay({ open, onClose, libraryId, fileId, viewType, title, onSwitchToStoryMode }: DetailOverlayProps) {
  const { t, locale } = useTranslation()
  const { translateDocument, loading: translationLoading } = useDocumentTranslation()
  
  // Debug: Logge viewType beim Rendern
  React.useEffect(() => {
    if (open) {
      console.log('[DetailOverlay] 🔍 viewType beim Öffnen:', {
        viewType,
        fileId,
        libraryId,
        expected: 'session',
        actual: viewType,
        isCorrect: viewType === 'session',
      })
    }
  }, [open, viewType, fileId, libraryId])
  
  // State für Tab und Übersetzung
  const [activeTab, setActiveTab] = React.useState<'original' | 'translated'>('original')
  const [originalData, setOriginalData] = React.useState<BookDetailData | SessionDetailData | null>(null)
  const [translatedData, setTranslatedData] = React.useState<BookDetailData | SessionDetailData | null>(null)
  const [originalLanguage, setOriginalLanguage] = React.useState<string>('EN')
  const [sessionUrl, setSessionUrl] = React.useState<string | null>(null)
  
  // Bestimme Titel basierend auf viewType, falls nicht explizit angegeben
  const displayTitle = title || (viewType === 'session' ? t('gallery.talkSummary') : t('gallery.documentView'))
  
  // Mapping von Locale zu Sprachcode (Großbuchstaben)
  const localeToLanguageCode: Record<string, string> = {
    de: 'DE',
    en: 'EN',
    it: 'IT',
    fr: 'FR',
    es: 'ES',
    ar: 'AR',
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
    
    console.log('[DetailOverlay] 📥 handleDataLoaded aufgerufen:', {
      viewType,
      fileId,
      dataFileId,
      hasData: !!data,
      targetLanguageCode,
      dataLanguage: (data as { language?: string }).language,
      translationKey,
      alreadyStarted: translationStartedRef.current === translationKey,
    })
    
    // Verhindere mehrfache Aufrufe für dieselbe Übersetzung
    if (translationStartedRef.current === translationKey) {
      console.log('[DetailOverlay] ⏭️ Übersetzung bereits gestartet, überspringe')
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
    
    console.log('[DetailOverlay] 🔍 Originalsprache aus handleDataLoaded:', {
      dataLanguage,
      dataLanguageType: typeof dataLanguage,
      lang,
      langCode,
    })
    
    // Setze Originalsprache mit funktionalem Update, um Race Conditions zu vermeiden
    setOriginalLanguage((prevLang) => {
      if (prevLang !== langCode) {
        console.log('[DetailOverlay] 🔄 Setze Originalsprache aus Daten:', {
          old: prevLang,
          new: langCode,
          source: dataLanguage ? 'data.language' : 'Fallback',
        })
        return langCode
      }
      return prevLang
    })
    
    // KEINE automatische Übersetzung beim ersten Öffnen
    // Übersetzung wird nur gestartet, wenn:
    // 1. Benutzer manuell auf "translated" Tab klickt, ODER
    // 2. Präferenz existiert und Dokument geöffnet wird (siehe useEffect)
    console.log('[DetailOverlay] ✅ Original-Daten geladen, keine automatische Übersetzung:', {
      originalLanguage: langCode,
      targetLanguage: targetLanguageCode,
      needsTranslation: langCode !== targetLanguageCode,
    })
  }, [fileId, viewType, targetLanguageCode])
  
  // Aktualisiere Ref, damit IngestionSessionDetail immer die neueste Version hat
  React.useEffect(() => {
    handleDataLoadedRef.current = handleDataLoaded
  }, [handleDataLoaded])
  
  // Tab-Wechsel Handler
  const handleTabChange = React.useCallback((value: string) => {
    console.log('[DetailOverlay] Tab-Wechsel:', {
      to: value,
      hasTranslatedData: !!translatedData,
      hasOriginalData: !!originalData,
      originalLanguage,
      targetLanguageCode,
    })
    
    if (value === 'translated') {
      // Benutzer wechselt zu Übersetzung: Speichere Präferenz global
      if (typeof window !== 'undefined') {
        localStorage.setItem(PREFER_TRANSLATION_KEY, 'true')
        console.log('[DetailOverlay] ✅ Präferenz gespeichert: Übersetzung bevorzugt (global)')
      }
      
      // Übersetzung laden, wenn noch nicht vorhanden
      if (!translatedData && originalData) {
        console.log('[DetailOverlay] Lade Übersetzung beim Tab-Wechsel:', {
          fileId,
          viewType,
          from: originalLanguage,
          to: targetLanguageCode,
        })
        
        const translationKey = `${fileId}-${targetLanguageCode}`
        translationStartedRef.current = translationKey
        
        translateDocument({
          libraryId,
          fileId,
          viewType,
        }).then((result) => {
          console.log('[DetailOverlay] Übersetzung beim Tab-Wechsel abgeschlossen:', {
            success: !!result?.translatedData,
            cached: result?.cached,
          })
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
        console.log('[DetailOverlay] ✅ Präferenz gelöscht: Original bevorzugt (global)')
      }
      setActiveTab('original')
    }
  }, [translatedData, originalData, libraryId, fileId, viewType, translateDocument, originalLanguage, targetLanguageCode])
  
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
    
    console.log('[DetailOverlay] 🔍 Präferenz beim Öffnen:', {
      preferTranslation,
      willShowTranslation: preferTranslation,
    })

    // Lade doc-meta, um Originalsprache zu ermitteln
    const loadLanguage = async () => {
      try {
        console.log('[DetailOverlay] 🔍 Lade Originalsprache:', { libraryId, fileId, viewType })
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
        const res = await fetch(url, { cache: 'no-store' })
        const json = await res.json()
        
        console.log('[DetailOverlay] 📥 doc-meta Response:', {
          ok: res.ok,
          hasDocMetaJson: !!json.docMetaJson,
          docMetaJsonType: typeof json.docMetaJson,
          languageField: json.docMetaJson?.language,
          languageType: typeof json.docMetaJson?.language,
          docMetaJsonKeys: json.docMetaJson && typeof json.docMetaJson === 'object' 
            ? Object.keys(json.docMetaJson).slice(0, 20) 
            : [],
        })
        
        if (res.ok && json.docMetaJson) {
          const docMetaJson = json.docMetaJson as Record<string, unknown>
          
          // Detaillierte Analyse der Sprache
          const languageField = docMetaJson.language
          console.log('[DetailOverlay] 🔎 Sprache-Analyse:', {
            languageField,
            languageFieldType: typeof languageField,
            languageFieldValue: languageField,
            isString: typeof languageField === 'string',
            isEmpty: typeof languageField === 'string' && languageField.trim().length === 0,
            isNull: languageField === null,
            isUndefined: languageField === undefined,
          })
          
          // Bestimme Originalsprache mit detailliertem Logging
          let lang: string
          let langSource: string
          
          if (typeof languageField === 'string' && languageField.trim().length > 0) {
            lang = languageField.trim()
            langSource = 'docMetaJson.language (explizit gesetzt)'
          } else {
            lang = 'EN'
            langSource = 'Fallback (docMetaJson.language fehlt oder leer)'
          }
          
          const langCode = lang.toUpperCase().slice(0, 2)
          
          console.log('[DetailOverlay] ✅ Originalsprache ermittelt:', {
            raw: lang,
            code: langCode,
            source: langSource,
            targetLanguageCode,
            needsTranslation: langCode !== targetLanguageCode,
            reason: langCode !== targetLanguageCode 
              ? `Übersetzung nötig: ${langCode} → ${targetLanguageCode}`
              : `Keine Übersetzung nötig: Originalsprache (${langCode}) = Zielsprache (${targetLanguageCode})`,
          })
          
          setOriginalLanguage(langCode)
          
          // URL für Sessions speichern
          if (viewType === 'session' && typeof docMetaJson.url === 'string') {
            console.log('[DetailOverlay] Session URL gefunden:', docMetaJson.url)
            setSessionUrl(docMetaJson.url)
          }
          
          // Wenn Präferenz existiert UND Übersetzung nötig ist: automatisch auf "translated" Tab wechseln
          if (preferTranslation && langCode !== targetLanguageCode) {
            console.log('[DetailOverlay] 🌐 Präferenz aktiv: Automatische Übersetzung beim Öffnen:', {
              preferTranslation,
              originalLanguage: langCode,
              targetLanguage: targetLanguageCode,
            })
            
            // Setze Tab auf "translated" (Übersetzung wird in separatem useEffect gestartet, wenn originalData vorhanden ist)
            setActiveTab('translated')
          } else {
            console.log('[DetailOverlay] ⏭️ Keine automatische Übersetzung beim Öffnen:', {
              preferTranslation,
              originalLanguage: langCode,
              targetLanguage: targetLanguageCode,
              reason: !preferTranslation 
                ? 'Keine Präferenz gesetzt'
                : langCode === targetLanguageCode 
                  ? 'Originalsprache = Zielsprache'
                  : 'Unbekannt',
            })
          }
        } else {
          // Fallback: "EN" wenn doc-meta nicht verfügbar ist
          console.log('[DetailOverlay] ⚠️ doc-meta nicht verfügbar, verwende Fallback "EN":', {
            ok: res.ok,
            hasDocMetaJson: !!json.docMetaJson,
            reason: !res.ok ? 'API-Fehler' : 'docMetaJson fehlt',
          })
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
        console.log('[DetailOverlay] ⏭️ Übersetzung bereits gestartet (Präferenz), überspringe')
        return
      }
      
      console.log('[DetailOverlay] 🌐 Starte automatische Übersetzung (Präferenz):', {
        fileId,
        viewType,
        from: originalLanguage,
        to: targetLanguageCode,
        preferTranslation,
      })
      
      translationStartedRef.current = translationKey
      
      translateDocument({
        libraryId,
        fileId,
        viewType,
      }).then((result) => {
        console.log('[DetailOverlay] ✅ Übersetzung abgeschlossen (Präferenz):', {
          success: !!result?.translatedData,
          cached: result?.cached,
        })
        if (result?.translatedData) {
          setTranslatedData(result.translatedData)
        }
      }).catch((err) => {
        console.error('[DetailOverlay] ❌ Übersetzungsfehler (Präferenz):', err)
        translationStartedRef.current = null
      })
    }
  }, [open, originalData, originalLanguage, targetLanguageCode, activeTab, translatedData, fileId, viewType, libraryId, translateDocument])
  
  // Debug: Logge viewType
  React.useEffect(() => {
    if (open) {
      console.log('[DetailOverlay] Rendering with viewType:', viewType, 'fileId:', fileId)
    }
  }, [open, viewType, fileId])
  
  // Prüfe, ob Tabs angezeigt werden sollen (nur wenn Originalsprache != Zielsprache)
  const shouldShowTabs = originalLanguage !== targetLanguageCode
  
  if (!open) return null
  return (
    <div className='fixed inset-0 z-50'>
      <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={onClose} />
      <div className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden'>
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
              <Button variant='ghost' size='icon' onClick={onClose}>
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
            
            {/* CTA-Button für Story Mode */}
            {onSwitchToStoryMode && (
              <div className="shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={onSwitchToStoryMode}
                        className="flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all"
                      >
                        <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>{t('gallery.detailViewStoryModeCta')}</span>
                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('gallery.storyModeTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
        <ScrollArea className='flex-1 w-full overflow-hidden relative'>
          <div className={`p-0 w-full max-w-full overflow-x-hidden transition-opacity duration-300 ${
            translationLoading && !translatedData ? 'opacity-70' : 'opacity-100'
          }`}>
            {viewType === 'session' ? (
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
            ) : (
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


