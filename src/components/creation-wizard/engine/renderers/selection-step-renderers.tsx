/**
 * Auswahl-Step-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1):
 * verwandte Testimonials + Ordner-Artefakte. Verbatim aus `creation-wizard.tsx`.
 */

import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { SelectRelatedTestimonialsStep } from "../../steps/select-related-testimonials-step"
import { SelectFolderArtifactsStep } from "../../steps/select-folder-artifacts-step"
import type { StepRenderContext } from "../step-render-context"

export function renderSelectRelatedTestimonialsStep(ctx: StepRenderContext): ReactNode {
  const { sources, seedFileIdState, onTestimonialSelectionChange } = ctx
  return (
    <SelectRelatedTestimonialsStep
      sources={sources}
      seedSourceId={seedFileIdState ? `file-${seedFileIdState}` : undefined}
      onSelectionChange={onTestimonialSelectionChange}
    />
  )
}

export function renderSelectFolderArtifactsStep(ctx: StepRenderContext): ReactNode {
  const { sourceFolderId, libraryId, onFolderArtifactSelectionChange } = ctx
  if (!sourceFolderId || !libraryId) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Kein Verzeichnis-Kontext. Bitte starte den Wizard aus einem Verzeichnis heraus.
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <SelectFolderArtifactsStep
      libraryId={libraryId}
      folderId={sourceFolderId}
      targetLanguage="de"
      onSelectionChange={onFolderArtifactSelectionChange}
    />
  )
}
