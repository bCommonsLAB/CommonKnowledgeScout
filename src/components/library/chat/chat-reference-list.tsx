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
 * Komponente für die Anzeige von Referenzen als Quellenverzeichnis (Accordion).
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

  // Gruppiere Referenzen nach fileId, dann nach sourceType
  const groupedDocs = useMemo(() => {
    const map = new Map<string, { 
      fileName?: string
      fileId: string
      sourceGroups: Map<string, { sourceType: string; references: ChatResponse['references'] }>
      references: ChatResponse['references']
    }>()
    
    for (const ref of references) {
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
          <div className="border-b">
            <div className="flex items-center justify-between pr-2">
              <AccordionTrigger className="text-xs text-muted-foreground flex-1">
                Verwendete Dokumente ({groupedDocs.length}):
              </AccordionTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleShowDocuments()
                }}
                className="h-6 text-xs shrink-0"
                aria-label="In Galerie zeigen"
              >
                <Filter className="h-3 w-3 mr-1" />
                do show
              </Button>
            </div>
          </div>
          <AccordionContent>
            <div className="space-y-2 mt-2">
              {groupedDocs.map((doc) => {
                const sourceGroupsArray = Array.from(doc.sourceGroups.values())
                
                // Zeige Gesamtanzahl der Referenzen für dieses Dokument
                const refNumbers = doc.references.map(r => r.number).sort((a, b) => a - b)
                const refNumbersStr = refNumbers.length <= 3 
                  ? refNumbers.join(', ')
                  : `${refNumbers[0]}-${refNumbers[refNumbers.length - 1]}`

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
                          <div className="text-muted-foreground text-[10px] mt-1">
                            Klicken zum Öffnen der Detailansicht
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* Source-Gruppen: Kompakte Anzeige nach Quelle */}
                    {sourceGroupsArray.length > 0 && (
                      <div className="px-2 pb-2 space-y-1">
                        {sourceGroupsArray.map((sourceGroup) => {
                          const sourceRefNumbers = sourceGroup.references.map(r => r.number).sort((a, b) => a - b)
                          const sourceRefNumbersStr = sourceRefNumbers.length <= 3 
                            ? sourceRefNumbers.join(', ')
                            : `${sourceRefNumbers[0]}-${sourceRefNumbers[sourceRefNumbers.length - 1]}`
                          const sourceLabel = getSourceTypeLabel(sourceGroup.sourceType)
                          
                          return (
                            <div key={sourceGroup.sourceType} className="flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
                              <Badge variant="outline" className="h-3 px-1 text-[9px]">
                                {sourceLabel}
                              </Badge>
                              <span className="text-[9px]">
                                [{sourceRefNumbersStr}] ({sourceGroup.references.length} {sourceGroup.references.length === 1 ? 'Stelle' : 'Stellen'})
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

