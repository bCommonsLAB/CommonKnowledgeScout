"use client"

import { useState, useEffect, useMemo } from "react"
import type { WizardSource } from "@/lib/creation/corpus"
import { TestimonialList, type TestimonialItem } from "@/components/shared/testimonial-list"

interface SelectRelatedTestimonialsStepProps {
  /** Alle gefundenen Testimonials als Sources */
  sources: WizardSource[]
  /** Callback wenn Auswahl geändert wird */
  onSelectionChange: (selectedSources: WizardSource[]) => void
}

/**
 * Konvertiert WizardSource zu TestimonialItem für gemeinsame Komponente.
 */
function convertWizardSourceToTestimonialItem(source: WizardSource): TestimonialItem {
  // Extrahiere testimonialId aus source.id (z.B. "file-xxx" oder "text-xxx")
  // Seit der Änderung in findRelatedEventTestimonialsFilesystem ist die ID bereits die testimonialId
  // Format: "file-{testimonialId}" oder "text-{testimonialId}"
  let testimonialId = source.id.replace(/^(file-|text-)/, '')
  
  // Fallback: Wenn _testimonialId vorhanden ist (aus findRelatedEventTestimonialsFilesystem),
  // verwende diese direkt
  // @ts-expect-error - WizardSource kann zusätzliche Felder haben
  if (source._testimonialId && typeof source._testimonialId === 'string') {
    testimonialId = source._testimonialId
  }
  
  // Wenn es eine Datei-ID ist, versuchen wir den Ordner-Namen aus fileName zu extrahieren
  // oder verwenden die ID als Fallback
  if (source.id.startsWith('file-') && source.fileName && !testimonialId.includes('-')) {
    // Versuche Ordner-Namen aus fileName zu extrahieren (z.B. "testimonial-2026-01-14.md" -> "testimonial-2026-01-14")
    const folderMatch = source.fileName.match(/^(.+?)(?:\.[^.]+)?$/)
    if (folderMatch) {
      testimonialId = folderMatch[1]
    }
  }
  
  // Extrahiere speakerName aus summary oder fileName
  let speakerName: string | null = null
  if (source.summary) {
    // Versuche "SpeakerName: ..." Pattern zu erkennen
    const match = source.summary.match(/^([^:]+):/)
    if (match) {
      speakerName = match[1].trim() || null
    }
  }
  if (!speakerName && source.fileName) {
    // Fallback: verwende Dateiname ohne Extension
    speakerName = source.fileName.replace(/\.[^/.]+$/, '') || null
  }
  
  // Extrahiere Text aus extractedText oder text
  const text = source.extractedText || source.text || null
  
  // createdAt aus source.createdAt
  const createdAt = source.createdAt instanceof Date 
    ? source.createdAt.toISOString() 
    : (typeof source.createdAt === 'string' ? source.createdAt : null)
  
  return {
    testimonialId,
    speakerName,
    createdAt,
    text,
    hasAudio: false, // Wizard-Sources haben kein Audio-Info
    audioFileName: null,
  }
}

/**
 * Step zur Auswahl/Exclude von Testimonials für Dialograum-Ergebnis.
 * 
 * Verwendet die gemeinsame TestimonialList-Komponente mit variant='select'.
 */
export function SelectRelatedTestimonialsStep({
  sources,
  onSelectionChange,
}: SelectRelatedTestimonialsStepProps) {
  // Filtere nur Testimonial-Sources (nicht Dialograum selbst)
  // WICHTIG: useMemo verwenden, damit die Referenz stabil bleibt
  const testimonialSources = useMemo(() => 
    sources.filter(s => 
      (s.kind === 'file' || s.kind === 'text') && 
      (s.id.startsWith('file-') || s.id.startsWith('text-')) && 
      !s.fileName?.toLowerCase().includes('dialograum')
    ),
    [sources]
  )
  
  // Konvertiere zu TestimonialItem[]
  const testimonialItems = useMemo(() => 
    testimonialSources.map(convertWizardSourceToTestimonialItem),
    [testimonialSources]
  )
  
  // Extrahiere IDs für Vergleich (stabile Referenz)
  const testimonialIds = useMemo(
    () => testimonialItems.map(it => it.testimonialId).sort().join(','),
    [testimonialItems]
  )
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(testimonialItems.map(it => it.testimonialId))
  )

  useEffect(() => {
    // Initial: Alle Testimonials sind ausgewählt, aber nur wenn sich die IDs geändert haben
    const allIds = new Set(testimonialItems.map(it => it.testimonialId))
    const currentIdsStr = Array.from(selectedIds).sort().join(',')
    const allIdsStr = Array.from(allIds).sort().join(',')
    
    // Nur aktualisieren, wenn sich die IDs tatsächlich geändert haben
    if (currentIdsStr !== allIdsStr) {
      setSelectedIds(allIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testimonialIds]) // Verwende testimonialIds statt testimonialItems (selectedIds absichtlich nicht in Dependencies)

  useEffect(() => {
    // Benachrichtige Parent über aktuelle Auswahl
    // WICHTIG: Nur ausführen, wenn sich selectedIds geändert hat (nicht bei jedem Render)
    const selected = testimonialSources.filter(s => {
      const itemId = s.id.replace(/^(file-|text-)/, '')
      return selectedIds.has(itemId)
    })
    onSelectionChange(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]) // Nur selectedIds als Dependency, nicht testimonialSources oder onSelectionChange

  return (
    <TestimonialList
      items={testimonialItems}
      isLoading={false}
      variant="select"
      initialSelectedIds={selectedIds}
      onSelectionChange={(newSelectedIds) => {
        setSelectedIds(newSelectedIds)
      }}
    />
  )
}

