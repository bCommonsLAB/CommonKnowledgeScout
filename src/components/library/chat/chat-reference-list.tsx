'use client'

import { useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, ExternalLink, Filter } from 'lucide-react'
import type { ChatResponse } from '@/types/chat-response'

interface ChatReferenceListProps {
  references: ChatResponse['references']
  libraryId: string
  onDocumentClick?: (fileId: string, fileName?: string) => void
}

/**
 * Komponente für die Anzeige von Referenzen als auf/zu klappbare Legende (Accordion).
 * Gruppiert Referenzen nach fileId und zeigt:
 * - Dokument-Namen (nicht einzelne Chunks)
 * - Tooltip mit Quelle-Typen (slides, body, video_transcript, chapter)
 * - Button "do show" → Filtert Gallery auf diese Dokumente
 * - Klick auf Dokument → Öffnet Detailansicht
 */
export function ChatReferenceList({ references, libraryId, onDocumentClick }: ChatReferenceListProps) {
  const [, setFilters] = useAtom(galleryFiltersAtom)
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)

  // Extrahiere sourceType aus description
  function extractSourceType(description: string): string | undefined {
    if (description.includes('Slide-Seite')) return 'slides'
    if (description.includes('Videotranskript')) return 'video_transcript'
    if (description.includes('Markdown-Body')) return 'body'
    if (description.includes('Kapitel')) return 'chapter'
    return undefined
  }

  // Gruppiere Referenzen nach fileId
  const groupedDocs = useMemo(() => {
    const map = new Map<string, { 
      fileName?: string
      fileId: string
      sourceTypes: Set<string>
      references: ChatResponse['references']
    }>()
    
    for (const ref of references) {
      const existing = map.get(ref.fileId)
      
      if (existing) {
        // Füge Quelle-Typ hinzu (aus description extrahieren)
        const sourceType = extractSourceType(ref.description)
        if (sourceType) {
          existing.sourceTypes.add(sourceType)
        }
        existing.references.push(ref)
        // Aktualisiere fileName falls vorhanden
        if (ref.fileName && !existing.fileName) {
          existing.fileName = ref.fileName
        }
      } else {
        const sourceTypes = new Set<string>()
        const sourceType = extractSourceType(ref.description)
        if (sourceType) {
          sourceTypes.add(sourceType)
        }
        map.set(ref.fileId, {
          fileId: ref.fileId,
          fileName: ref.fileName,
          sourceTypes,
          references: [ref],
        })
      }
    }
    
    return Array.from(map.values())
  }, [references])

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

  // Button "do show" → Filtert Gallery auf diese Dokumente
  const handleShowDocuments = () => {
    if (groupedDocs.length === 0) return
    
    // Setze Filter auf fileId-Liste
    const fileIds = groupedDocs.map(d => d.fileId)
    setFilters({ fileId: fileIds })
    
    // Optional: Scroll zur Gallery
    const galleryElement = document.querySelector('[data-gallery-section]')
    if (galleryElement) {
      galleryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  if (references.length === 0) return null

  return (
    <div className="mt-3">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="references">
          <AccordionTrigger className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between w-full pr-2">
              <span>Verwendete Dokumente ({groupedDocs.length}):</span>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleShowDocuments()
                }}
                className="h-6 text-xs"
                aria-label="In Galerie zeigen"
              >
                <Filter className="h-3 w-3 mr-1" />
                do show
              </Button>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 mt-2">
              {groupedDocs.map((doc) => {
                const sourceTypesArray = Array.from(doc.sourceTypes)
                const sourceTypesLabel = sourceTypesArray.length > 0
                  ? sourceTypesArray.map(getSourceTypeLabel).join(', ')
                  : 'Unbekannt'
                
                // Zeige Anzahl der Referenzen für dieses Dokument
                const refNumbers = doc.references.map(r => r.number).sort((a, b) => a - b)
                const refNumbersStr = refNumbers.length <= 3 
                  ? refNumbers.join(', ')
                  : `${refNumbers[0]}-${refNumbers[refNumbers.length - 1]}`

                return (
                  <Tooltip key={doc.fileId}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                [{refNumbersStr}]
                              </Badge>
                              <span className="text-xs font-medium truncate">
                                {doc.fileName || doc.fileId.slice(0, 30)}
                              </span>
                              {sourceTypesArray.length > 0 && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                  {sourceTypesArray.length}
                                </Badge>
                              )}
                            </div>
                            {sourceTypesArray.length > 0 && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {sourceTypesLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 shrink-0"
                          onClick={() => handleDocumentClick(doc.fileId, doc.fileName)}
                          aria-label={`${doc.fileName || doc.fileId} öffnen`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px] p-2">
                      <div className="text-xs space-y-1">
                        <div className="font-medium">{doc.fileName || doc.fileId}</div>
                        {sourceTypesArray.length > 0 && (
                          <div className="text-muted-foreground">
                            Quelle: {sourceTypesLabel}
                          </div>
                        )}
                        <div className="text-muted-foreground text-[10px] mt-1">
                          Referenzen: [{refNumbersStr}]
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-1">
                          Klicken zum Öffnen der Detailansicht
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

