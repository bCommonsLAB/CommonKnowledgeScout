'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@ks/ui'
import type { DocReference, QuerySource } from '@ks/contracts'
import { ReferenceList } from '@/components/library/gallery/reference-list'

interface ReferenceGroupHeaderProps {
  /** Titel der Gruppe */
  title: string
  /** Anzahl der Dokumente in dieser Gruppe */
  docCount: number
  /** Referenzen für diese Gruppe (für verwendete Dokumente) */
  references?: DocReference[]
  /** Sources für diese Gruppe (für nicht verwendete Dokumente) */
  sources?: QuerySource[]
  /** QueryId zum Laden der Sources */
  queryId?: string
  /** LibraryId */
  libraryId: string
  /** Callback für Dokument-Klick */
  onDocumentClick?: (fileId: string, fileName?: string) => void
  /** Accordion-Wert für diese Gruppe */
  value: string
}

/**
 * Kompakter Header für eine Referenzgruppe in der Gallery
 * Zeigt Titel, Anzahl Dokumente und aufklappbare Referenzliste
 */
export function ReferenceGroupHeader({
  title,
  docCount,
  references,
  sources,
  queryId,
  libraryId,
  onDocumentClick,
  value,
}: ReferenceGroupHeaderProps) {
  // Erstelle kompakte Referenzliste nur für verwendete Dokumente
  const hasReferences = references && references.length > 0

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={value} className="border-b">
        <div className="flex items-center justify-between pr-2">
          <AccordionTrigger className="text-sm font-semibold flex-1 py-3">
            {title} ({docCount})
          </AccordionTrigger>
        </div>
        <AccordionContent className="pt-2 pb-4">
          {/* Zeige Referenzliste nur für verwendete Dokumente (kompakte Variante) */}
          {hasReferences && (
            <ReferenceList
              references={references}
              libraryId={libraryId}
              queryId={queryId}
              onDocumentClick={onDocumentClick}
              variant="compact"
            />
          )}
          {/* Für nicht verwendete Dokumente zeigen wir nur eine Zusammenfassung */}
          {!hasReferences && sources && sources.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {sources.length} {sources.length === 1 ? 'Stelle gefunden' : 'Stellen gefunden'}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

