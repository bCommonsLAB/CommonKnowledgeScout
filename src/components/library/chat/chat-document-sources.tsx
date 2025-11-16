'use client'

import { useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, Filter } from 'lucide-react'
import type { RetrievedSource } from '@/types/retriever'

interface ChatDocumentSourcesProps {
  sources: RetrievedSource[]
  libraryId: string
  onDocumentClick?: (fileId: string, fileName?: string) => void
}

/**
 * Komponente für die Anzeige von Dokument-Referenzen im Chat.
 * Gruppiert Sources nach fileId und zeigt:
 * - Dokument-Namen (nicht einzelne Chunks)
 * - Tooltip mit Quelle (slides, body, video_transcript)
 * - Button "do show" → Filtert Gallery auf diese Dokumente
 * - Klick auf Dokument → Öffnet Detailansicht
 */
export function ChatDocumentSources({ sources, libraryId, onDocumentClick }: ChatDocumentSourcesProps) {
  const [, setFilters] = useAtom(galleryFiltersAtom)
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)

  // Gruppiere Sources nach fileId
  const groupedDocs = useMemo(() => {
    const map = new Map<string, { fileName?: string; sourceTypes: Set<string>; fileId: string }>()
    
    for (const src of sources) {
      // Verwende fileId aus Source, oder extrahiere aus id
      let fileId = src.fileId
      if (!fileId) {
        // Extrahiere aus id (Format: "fileId-chunkIndex" oder "fileId-chap-chapterId")
        const parts = src.id.split('-')
        const lastPart = parts[parts.length - 1]
        // Wenn letzter Teil eine Zahl ist oder "chap" enthält, nimm alles davor
        if (lastPart && (/^\d+$/.test(lastPart) || lastPart.startsWith('chap'))) {
          fileId = parts.slice(0, -1).join('-')
        } else {
          // Fallback: alles außer letztem Teil
          fileId = parts.slice(0, -1).join('-') || src.id
        }
      }
      
      const existing = map.get(fileId)
      
      if (existing) {
        // Füge sourceType hinzu (falls vorhanden)
        if (src.sourceType) {
          existing.sourceTypes.add(src.sourceType)
        }
        // Aktualisiere fileName falls vorhanden
        if (src.fileName && !existing.fileName) {
          existing.fileName = src.fileName
        }
      } else {
        const sourceTypes = new Set<string>()
        if (src.sourceType) {
          sourceTypes.add(src.sourceType)
        }
        map.set(fileId, {
          fileId,
          fileName: src.fileName,
          sourceTypes,
        })
      }
    }
    
    return Array.from(map.values())
  }, [sources])

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
    
    // Setze Filter auf shortTitle-Liste
    const shortTitles = groupedDocs
      .map(d => d.shortTitle || d.title)
      .filter((title): title is string => !!title)
    if (shortTitles.length > 0) {
      setFilters({ shortTitle: shortTitles })
    }
    
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

  if (groupedDocs.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Verwendete Dokumente ({groupedDocs.length}):
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShowDocuments}
          className="h-7 text-xs"
        >
          <Filter className="h-3 w-3 mr-1" />
          do show
        </Button>
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {groupedDocs.map((doc) => {
          const sourceTypesArray = Array.from(doc.sourceTypes)
          const sourceTypesLabel = sourceTypesArray.length > 0
            ? sourceTypesArray.map(getSourceTypeLabel).join(', ')
            : 'Unbekannt'

          return (
            <Tooltip key={doc.fileId}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleDocumentClick(doc.fileId, doc.fileName)}
                  aria-label={`${doc.fileName || doc.fileId} öffnen`}
                >
                  <FileText className="h-3 w-3 mr-1.5" />
                  <span className="truncate max-w-[200px]">
                    {doc.fileName || doc.fileId.slice(0, 20)}
                  </span>
                  {sourceTypesArray.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                      {sourceTypesArray.length}
                    </Badge>
                  )}
                </Button>
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
                    Klicken zum Öffnen der Detailansicht
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

