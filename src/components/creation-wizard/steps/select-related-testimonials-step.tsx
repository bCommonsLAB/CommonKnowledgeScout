"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import type { WizardSource } from "@/lib/creation/corpus"
import { CompactSourcesInfo } from "@/components/creation-wizard/components/compact-sources-info"

interface SelectRelatedTestimonialsStepProps {
  /** Alle gefundenen Testimonials als Sources */
  sources: WizardSource[]
  /** Callback wenn Auswahl geändert wird */
  onSelectionChange: (selectedSources: WizardSource[]) => void
}

/**
 * Step zur Auswahl/Exclude von Testimonials für Dialograum-Ergebnis.
 * 
 * Zeigt eine Liste aller gefundenen Testimonials mit Checkboxen.
 * User kann einzelne Testimonials ausschließen.
 */
export function SelectRelatedTestimonialsStep({
  sources,
  onSelectionChange,
}: SelectRelatedTestimonialsStepProps) {
  // Filtere nur Testimonial-Sources (nicht Dialograum selbst)
  const testimonialSources = sources.filter(s => 
    s.kind === 'file' && 
    s.id.startsWith('file-') && 
    s.fileName && 
    !s.fileName.toLowerCase().includes('dialograum')
  )
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(testimonialSources.map(s => s.id))
  )

  useEffect(() => {
    // Initial: Alle Testimonials sind ausgewählt
    const allIds = new Set(testimonialSources.map(s => s.id))
    setSelectedIds(allIds)
  }, [testimonialSources])

  useEffect(() => {
    // Benachrichtige Parent über aktuelle Auswahl
    const selected = testimonialSources.filter(s => selectedIds.has(s.id))
    onSelectionChange(selected)
  }, [selectedIds, testimonialSources, onSelectionChange])

  const handleToggle = (sourceId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  if (testimonialSources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Testimonials prüfen</CardTitle>
          <CardDescription>
            Es wurden keine Testimonials gefunden, die zu diesem Dialograum gehören.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testimonials prüfen</CardTitle>
        <CardDescription>
          {testimonialSources.length} Testimonial(s) gefunden. 
          Du kannst einzelne Testimonials ausschließen, wenn sie nicht verwendet werden sollen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {testimonialSources.map((source) => {
            const isSelected = selectedIds.has(source.id)
            const fileName = source.fileName || 'unbekannt'
            const summary = source.summary || ''
            
            return (
              <div
                key={source.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(source.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{fileName}</div>
                  {summary && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {summary}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} von {testimonialSources.length} Testimonial(s) ausgewählt
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

