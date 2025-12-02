'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, ExternalLink } from 'lucide-react'
import type { ChatResponse } from '@/types/chat-response'
import type { QueryLog } from '@/types/query-log'
import { useSessionHeaders } from '@/hooks/use-session-headers'
import { useTranslation } from '@/lib/i18n/hooks'

interface ChatReferenceListProps {
  references: ChatResponse['references']
  libraryId: string
  queryId?: string // Optional: Falls vorhanden, werden sources aus QueryLog geladen
  onDocumentClick?: (fileId: string, fileName?: string) => void
  /** Variante: 'full' zeigt vollständige Accordion-Struktur, 'compact' zeigt nur die Listen ohne äußere Accordion */
  variant?: 'full' | 'compact'
}

/**
 * Komponente für die Anzeige von Referenzen als Quellenverzeichnis (Accordion).
 * Zeigt zwei Abschnitte:
 * 1. "In der Antwort gelandete Dokumente" - Referenzen, die vom LLM verwendet wurden
 * 2. "Andere Dokumente, die sich auch mit dieser Frage beschäftigen" - Quellen, die gefunden wurden, aber nicht verwendet wurden
 * 
 * Gruppiert Dokumente nach fileId und zeigt:
 * - Dokument-Namen (nicht einzelne Chunks)
 * - Tooltip mit Quelle-Typen (slides, body, video_transcript, chapter)
 * - Klick auf Dokument → Öffnet Detailansicht
 */
export function ChatReferenceList({ references, libraryId, queryId, onDocumentClick, variant = 'full' }: ChatReferenceListProps) {
  const { t } = useTranslation()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const sessionHeaders = useSessionHeaders()
  const [sources, setSources] = useState<QueryLog['sources']>([])
  const [isLoadingSources, setIsLoadingSources] = useState(false)

  // Lade sources aus QueryLog, falls queryId vorhanden ist
  useEffect(() => {
    if (!queryId || !libraryId) {
      setSources([])
      return
    }

    let cancelled = false

    async function loadSources() {
      setIsLoadingSources(true)
      try {
        if (!queryId) {
          setIsLoadingSources(false)
          return
        }
        
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
          cache: 'no-store',
          headers: Object.keys(sessionHeaders).length > 0 ? sessionHeaders : undefined,
        })
        
        if (!res.ok || cancelled) {
          setIsLoadingSources(false)
          return
        }
        
        const queryLog = await res.json() as QueryLog
        
        if (cancelled) {
          setIsLoadingSources(false)
          return
        }
        
        const loadedSources = queryLog.sources || []
        setSources(loadedSources)
        
        
        setIsLoadingSources(false)
      } catch (error) {
        console.error('[ChatReferenceList] Fehler beim Laden der Sources:', error)
        setSources([])
        setIsLoadingSources(false)
      }
    }

    loadSources()

    return () => {
      cancelled = true
    }
  }, [queryId, libraryId, sessionHeaders])

  // Extrahiere sourceType aus description
  const extractSourceType = useCallback((description: string): string | undefined => {
    if (description.includes('Slide-Seite') || description.includes('Slide page')) return 'slides'
    if (description.includes('Videotranskript') || description.includes('Video transcript')) return 'video_transcript'
    if (description.includes('Markdown-Body') || description.includes('Markdown body')) return 'body'
    if (description.includes('Kapitel') || description.includes('Chapter')) return 'chapter'
    return undefined
  }, [])

  // Gemeinsame Funktion zum Gruppieren von Referenzen nach fileId
  const groupReferencesByFileId = useCallback((refs: ChatResponse['references']): Array<{
    fileName?: string
    fileId: string
    sourceGroups: Map<string, { sourceType: string; references: ChatResponse['references'] }>
    references: ChatResponse['references']
  }> => {
    const map = new Map<string, { 
      fileName?: string
      fileId: string
      sourceGroups: Map<string, { sourceType: string; references: ChatResponse['references'] }>
      references: ChatResponse['references']
    }>()
    
    for (const ref of refs) {
      const existing = map.get(ref.fileId)
      const sourceType = extractSourceType(ref.description) || 'unknown'
      
      if (existing) {
        // Füge Referenz zu sourceGroup hinzu
        const sourceGroup = existing.sourceGroups.get(sourceType)
        if (sourceGroup) {
          sourceGroup.references.push(ref)
        } else {
          existing.sourceGroups.set(sourceType, {
            sourceType,
            references: [ref],
          })
        }
        existing.references.push(ref)
        // Aktualisiere fileName falls vorhanden
        if (ref.fileName && !existing.fileName) {
          existing.fileName = ref.fileName
        }
      } else {
        const sourceGroups = new Map<string, { sourceType: string; references: ChatResponse['references'] }>()
        sourceGroups.set(sourceType, {
          sourceType,
          references: [ref],
        })
        map.set(ref.fileId, {
          fileId: ref.fileId,
          fileName: ref.fileName,
          sourceGroups,
          references: [ref],
        })
      }
    }
    
    return Array.from(map.values())
  }, [extractSourceType])

  // Erstelle Map von Referenznummer zu Score (aus Sources)
  // WICHTIG: Die Referenznummer entspricht der Position in der ursprünglichen Sources-Liste (1-basiert)
  // Die Sources im QueryLog enthalten alle gefundenen Quellen, auch die nicht verwendeten
  const referenceScoreMap = useMemo(() => {
    const map = new Map<number, number>()
    if (!sources || sources.length === 0) {
      return map
    }
    
    // Die Referenznummer entspricht der Position in der Sources-Liste (1-basiert)
    sources.forEach((source, index) => {
      if (typeof source.score === 'number') {
        map.set(index + 1, source.score)
      }
    })
    
    return map
  }, [sources])

  // Gruppiere Referenzen nach fileId, dann nach sourceType, inkl. Scores
  const groupedUsedDocs = useMemo(() => {
    const grouped = groupReferencesByFileId(references)
    
    // Füge Score-Informationen hinzu
    return grouped.map(doc => {
      // Sammle alle Scores für dieses Dokument
      const scores: number[] = []
      doc.references.forEach(ref => {
        const score = referenceScoreMap.get(ref.number)
        if (typeof score === 'number') {
          scores.push(score)
        }
      })
      
      const avgScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : undefined
      
      return {
        ...doc,
        avgScore,
        hasScore: scores.length > 0,
      }
    })
  }, [references, groupReferencesByFileId, referenceScoreMap])

  // Finde nicht verwendete Quellen (sources, die nicht in references sind)
  const unusedSources = useMemo(() => {
    if (!sources || sources.length === 0) return []
    
    // Erstelle Set von verwendeten fileIds aus references
    const usedFileIds = new Set(references.map(ref => ref.fileId))
    
    // Filtere sources, die nicht in references sind
    // Extrahiere fileId aus source.id (Format: "fileId-chunkIndex" oder ähnlich)
    return sources.filter(source => {
      const fileId = source.id.split('-')[0] // Extrahiere fileId aus id
      return !usedFileIds.has(fileId)
    })
  }, [sources, references])

  // Gruppiere nicht verwendete Quellen nach fileId
  const groupedUnusedDocs = useMemo(() => {
    if (unusedSources.length === 0) return []
    
    const map = new Map<string, { 
      fileName?: string
      fileId: string
      sources: NonNullable<QueryLog['sources']>
    }>()
    
    for (const source of unusedSources) {
      const fileId = source.id.split('-')[0] // Extrahiere fileId aus id
      const existing = map.get(fileId)
      
      if (existing) {
        existing.sources.push(source)
        // Aktualisiere fileName falls vorhanden
        if (source.fileName && !existing.fileName) {
          existing.fileName = source.fileName
        }
      } else {
        map.set(fileId, {
          fileId,
          fileName: source.fileName,
          sources: [source],
        })
      }
    }
    
    return Array.from(map.values())
  }, [unusedSources])

  // Übersetze sourceType zu lesbarem Text
  const getSourceTypeLabel = (sourceType: string): string => {
    switch (sourceType) {
      case 'slides':
        return 'Slides'
      case 'body':
        return 'Markdown-Body'
      case 'video_transcript':
        return 'Video-Transkript'
      case 'chapter':
        return 'Kapitel'
      default:
        return sourceType
    }
  }


  // Klick auf Dokument → Öffnet Detailansicht
  const handleDocumentClick = (fileId: string, fileName?: string) => {
    if (onDocumentClick) {
      onDocumentClick(fileId, fileName)
    } else {
      // Fallback: Öffne Detailansicht über Event
      const event = new CustomEvent('open-document-detail', {
        detail: { fileId, fileName, libraryId: activeLibraryId || libraryId },
      })
      window.dispatchEvent(event)
    }
  }

  // Rendere Dokument-Liste für verwendete Referenzen
  const renderUsedDocumentsList = () => {
    if (groupedUsedDocs.length === 0) return null

    return (
      <div className="space-y-2 mt-2">
        {groupedUsedDocs.map((doc) => {
          const sourceGroupsArray = Array.from(doc.sourceGroups.values())
          
          // Zeige Gesamtanzahl der Referenzen für dieses Dokument
          const refNumbers = doc.references.map(r => r.number).sort((a, b) => a - b)
          const refNumbersStr = refNumbers.length <= 3 
            ? refNumbers.join(', ')
            : `${refNumbers[0]}-${refNumbers[refNumbers.length - 1]}`

          const avgScore = 'avgScore' in doc ? doc.avgScore : undefined
          const hasScore = 'hasScore' in doc ? doc.hasScore : false

          return (
            <div key={doc.fileId} className="rounded border bg-muted/30 hover:bg-muted/50 transition-colors">
              {/* Dokument-Header */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between gap-2 p-2 cursor-pointer" onClick={() => handleDocumentClick(doc.fileId, doc.fileName)}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          [{refNumbersStr}]
                        </Badge>
                        {hasScore && avgScore !== undefined && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Score {avgScore.toFixed(2)}
                          </Badge>
                        )}
                        <span className="text-xs font-medium truncate">
                          {doc.fileName || doc.fileId.slice(0, 30)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDocumentClick(doc.fileId, doc.fileName)
                      }}
                      aria-label={`${doc.fileName || doc.fileId} öffnen`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] p-2">
                  <div className="text-xs space-y-1">
                    <div className="font-medium">{doc.fileName || doc.fileId}</div>
                    <div className="text-muted-foreground text-[10px] mt-1">
                      Referenzen: [{refNumbersStr}]
                    </div>
                    {hasScore && avgScore !== undefined && (
                      <div className="text-muted-foreground text-[10px] mt-1">
                        Ø Score: {avgScore.toFixed(3)}
                      </div>
                    )}
                    <div className="text-muted-foreground text-[10px] mt-1">
                      Klicken zum Öffnen der Detailansicht
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              {/* Source-Gruppen: Kompakte Anzeige nach Quelle */}
              {sourceGroupsArray.length > 0 && (
                <div className="px-2 pb-2 flex flex-wrap items-center gap-2 pl-5">
                  {sourceGroupsArray.map((sourceGroup) => {
                    const sourceRefNumbers = sourceGroup.references.map(r => r.number).sort((a, b) => a - b)
                    const sourceRefNumbersStr = sourceRefNumbers.length <= 3 
                      ? sourceRefNumbers.join(', ')
                      : `${sourceRefNumbers[0]}-${sourceRefNumbers[sourceRefNumbers.length - 1]}`
                    const sourceLabel = getSourceTypeLabel(sourceGroup.sourceType)
                    
                    return (
                      <div key={sourceGroup.sourceType} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="h-3 px-1 text-[9px]">
                          {sourceLabel}
                        </Badge>
                        <span className="text-[9px]">
                          [{sourceRefNumbersStr}] ({sourceGroup.references.length} {sourceGroup.references.length === 1 ? t('gallery.passage') : t('gallery.passages')})
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Rendere Dokument-Liste für nicht verwendete Quellen
  const renderUnusedDocumentsList = () => {
    if (groupedUnusedDocs.length === 0) return null

    return (
      <div className="space-y-2 mt-2">
        {groupedUnusedDocs.map((doc) => {
          if (!doc.sources || doc.sources.length === 0) return null
          
          const sourcesCount = doc.sources.length
          const hasScore = doc.sources.some(s => typeof s.score === 'number')
          const avgScore = hasScore 
            ? doc.sources.reduce((sum, s) => sum + (typeof s.score === 'number' ? s.score : 0), 0) / sourcesCount
            : undefined

          return (
            <div key={doc.fileId} className="rounded border bg-muted/20 hover:bg-muted/40 transition-colors">
              {/* Dokument-Header */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between gap-2 p-2 cursor-pointer" onClick={() => handleDocumentClick(doc.fileId, doc.fileName)}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {avgScore !== undefined && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Score {avgScore.toFixed(2)}
                          </Badge>
                        )}
                        <span className="text-xs font-medium truncate">
                          {doc.fileName || doc.fileId.slice(0, 30)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({sourcesCount} {sourcesCount === 1 ? t('gallery.passage') : t('gallery.passages')})
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDocumentClick(doc.fileId, doc.fileName)
                      }}
                      aria-label={`${doc.fileName || doc.fileId} öffnen`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] p-2">
                  <div className="text-xs space-y-1">
                    <div className="font-medium">{doc.fileName || doc.fileId}</div>
                    <div className="text-muted-foreground text-[10px] mt-1">
                      {sourcesCount} {sourcesCount === 1 ? 'Stelle gefunden' : 'Stellen gefunden'}
                      {avgScore !== undefined && ` (Ø Score: ${avgScore.toFixed(3)})`}
                    </div>
                    <div className="text-muted-foreground text-[10px] mt-1">
                      Klicken zum Öffnen der Detailansicht
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </div>
    )
  }

  if (references.length === 0 && groupedUnusedDocs.length === 0) return null

  // Kompakte Variante: Zeige nur die Listen ohne äußere Accordion-Struktur
  if (variant === 'compact') {
    return (
      <div className="mt-2">
        {/* Abschnitt 1: In der Antwort gelandete Dokumente */}
        {groupedUsedDocs.length > 0 && (
          <div className="mb-4">
            {renderUsedDocumentsList()}
          </div>
        )}

        {/* Abschnitt 2: Andere Dokumente, die sich auch mit dieser Frage beschäftigen */}
        {groupedUnusedDocs.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              {t('gallery.otherDocuments')} ({groupedUnusedDocs.length}):
            </div>
            {isLoadingSources ? (
              <div className="text-xs text-muted-foreground py-2">Lade Quellen...</div>
            ) : (
              renderUnusedDocumentsList()
            )}
          </div>
        )}
      </div>
    )
  }

  // Vollständige Variante: Zeige Accordion-Struktur
  return (
    <div className="mt-3">
      <Accordion type="single" collapsible className="w-full">
        {/* Abschnitt 1: In der Antwort gelandete Dokumente */}
        {groupedUsedDocs.length > 0 && (
          <AccordionItem value="used-references">
            <div className="border-b">
              <div className="flex items-center justify-between pr-2">
                <AccordionTrigger className="text-xs text-muted-foreground flex-1">
                  {t('gallery.usedDocuments')} ({groupedUsedDocs.length}):
                </AccordionTrigger>
              </div>
            </div>
            <AccordionContent>
              {renderUsedDocumentsList()}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Abschnitt 2: Andere Dokumente, die sich auch mit dieser Frage beschäftigen */}
        {groupedUnusedDocs.length > 0 && (
          <AccordionItem value="unused-sources">
            <div className="border-b">
              <div className="flex items-center justify-between pr-2">
                <AccordionTrigger className="text-xs text-muted-foreground flex-1">
                  {t('gallery.otherDocuments')} ({groupedUnusedDocs.length}):
                </AccordionTrigger>
              </div>
            </div>
            <AccordionContent>
              {isLoadingSources ? (
                <div className="text-xs text-muted-foreground py-2">Lade Quellen...</div>
              ) : (
                renderUnusedDocumentsList()
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}

