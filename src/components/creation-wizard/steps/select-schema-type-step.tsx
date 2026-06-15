"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { DETAIL_VIEW_TYPES } from "@/lib/detail-view-types/registry"
import { VIEW_TYPE_LABELS } from "@/lib/detail-view-types/view-type-display"

interface SelectSchemaTypeStepProps {
  /** Aktuell gewählter Inhaltstyp (detailViewType) oder undefined. */
  selected?: string
  /** Wird mit dem gewählten detailViewType aufgerufen. */
  onSelect: (detailViewType: string) => void
}

/**
 * U6b — Inhaltstyp nach dem Upload wählen (Inbox-Capture).
 *
 * Zeigt die acht Standard-Inhaltstypen (DETAIL_VIEW_TYPES) als auswählbare
 * Kacheln. Die Wahl steuert das Analyse-Standard-Template (`standard-<viewType>`)
 * und den `detailViewType` der Submission. Kein stiller Default — der Nutzer muss
 * aktiv wählen (canProceed gated auf `selectedDetailViewType`).
 */
export function SelectSchemaTypeStep({ selected, onSelect }: SelectSchemaTypeStepProps) {
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
            const isSelected = selected === viewType
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
      </CardContent>
    </Card>
  )
}
