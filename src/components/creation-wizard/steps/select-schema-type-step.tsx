"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { DETAIL_VIEW_TYPES } from "@/lib/detail-view-types/registry"
import { VIEW_TYPE_LABELS } from "@/lib/detail-view-types/view-type-display"
import { JobProgressBar } from "@/components/library/file-preview/job-progress-bar"

interface SelectSchemaTypeStepProps {
  /** Aktuell gewählter Inhaltstyp (detailViewType) oder undefined. */
  selected?: string
  /** Wird mit dem gewählten detailViewType aufgerufen. */
  onSelect: (detailViewType: string) => void
  /** 5a: Ist „Nur importieren und transkribieren" aktiv? */
  transcriptOnly?: boolean
  /** 5a: Wahl „Nur transkribieren" (schließt die Inhaltstyp-Wahl aus). */
  onSelectTranscriptOnly?: () => void
  /** Läuft die Off-target-Berechnung gerade (nach „Weiter")? */
  isProcessing?: boolean
  /** Fortschritt 0..100 der Berechnung (vom Secretary). */
  processingProgress?: number
  /** Fortschritts-/Status-Text während der Berechnung. */
  processingMessage?: string
  /** Pipeline-Phase (extract/transform/ingest) für das Schritt-Label. */
  processingPhase?: string
  /** Fehlermeldung der letzten Berechnung (falls fehlgeschlagen). */
  error?: string
}

/**
 * U6b — Inhaltstyp nach dem Upload wählen (Inbox-Capture).
 *
 * Zeigt die acht Standard-Inhaltstypen (DETAIL_VIEW_TYPES) als auswählbare
 * Kacheln plus die Option „Nur importieren und transkribieren" (5a). Die Wahl
 * steuert das Analyse-Standard-Template (`standard-<viewType>`) und den
 * `detailViewType` der Submission; „Nur transkribieren" schaltet die
 * Transformation ganz ab. Kein stiller Default — der Nutzer muss aktiv wählen
 * (canProceed gated auf Inhaltstyp ODER transcriptOnly). Beide Optionen
 * schließen sich gegenseitig aus.
 *
 * Während der Berechnung (nach „Weiter") zeigt der Step ein Lade-Feedback —
 * der Compute läuft off-target über die Inbox und kann dauern (Secretary).
 */
export function SelectSchemaTypeStep({
  selected,
  onSelect,
  transcriptOnly = false,
  onSelectTranscriptOnly,
  isProcessing = false,
  processingProgress,
  processingMessage,
  processingPhase,
  error,
}: SelectSchemaTypeStepProps) {
  if (isProcessing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datei wird verarbeitet</CardTitle>
          <CardDescription>
            Der Inhalt wird in der Inbox extrahiert bzw. transkribiert — du wirst
            Schritt für Schritt informiert. Das kann einen Moment dauern.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {/* Gleiche Progress-Logik wie im Archiv (Phase-Label + Fortschritt + Meldung). */}
          <JobProgressBar
            status="running"
            progress={processingProgress}
            message={processingMessage}
            phase={processingPhase}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inhaltstyp wählen</CardTitle>
        <CardDescription>
          Was für ein Inhalt ist das? Die Wahl bestimmt, wie der Beitrag
          aufbereitet und angezeigt wird.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DETAIL_VIEW_TYPES.map((viewType) => {
            // Inhaltstyp ist nur „aktiv", wenn nicht „Nur transkribieren" gewählt ist.
            const isSelected = !transcriptOnly && selected === viewType
            return (
              <button
                key={viewType}
                type="button"
                onClick={() => onSelect(viewType)}
                aria-pressed={isSelected}
                className={cn(
                  "flex items-center justify-between rounded-md border p-3 text-left text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 font-medium"
                    : "hover:border-muted-foreground/40",
                )}
              >
                <span>{VIEW_TYPE_LABELS[viewType]}</span>
                {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            )
          })}
        </div>
        {/* 5a: Alternative zur Aufbereitung — nur den Originaltext extrahieren. */}
        <button
          type="button"
          onClick={() => onSelectTranscriptOnly?.()}
          aria-pressed={transcriptOnly}
          className={cn(
            "mt-3 flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors",
            transcriptOnly
              ? "border-primary bg-primary/5 font-medium"
              : "hover:border-muted-foreground/40",
          )}
        >
          <span className="flex flex-col">
            <span>Nur importieren und transkribieren</span>
            <span className="text-xs text-muted-foreground">
              Ohne weitere Verarbeitung — nur den Originaltext
            </span>
          </span>
          {transcriptOnly ? <Check className="h-4 w-4 text-primary" /> : null}
        </button>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
