/**
 * uploadImages-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1).
 * Verbatim aus `creation-wizard.tsx`: Bildfeld-Ableitung, Einzel-/Array-Upload,
 * Merge der Bild-URLs in draftMetadata/reviewedFields.
 */

import type { ReactNode } from "react"
import { UploadImagesStep } from "../../steps/upload-images-step"
import type { StepRenderContext } from "../step-render-context"

export function renderUploadImagesStep(ctx: StepRenderContext): ReactNode {
  const { currentStep, template, wizardState, libraryId, sourceFolderId, setWizardState } = ctx
  // Bildfelder kommen aus dem aktuellen Step (fields)
  const imageFieldKeys = currentStep.fields || []

  if (imageFieldKeys.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Keine Bildfelder konfiguriert. Bitte im Template-Editor Bildfelder für diesen Step auswählen.
      </div>
    )
  }

  // Konvertiere fieldKeys zu imageFields-Format für UploadImagesStep.
  // Array-Felder (rawValue enthält "Array") bekommen multiple=true.
  const imageFields = imageFieldKeys.map((key) => {
    const fieldMeta = template.metadata.fields.find((f) => f.key === key)
    const isArray = fieldMeta?.rawValue?.includes("Array") || false
    return {
      key,
      label: fieldMeta?.description || key,
      multiple: isArray,
    }
  })

  return (
    <UploadImagesStep
      imageFields={imageFields}
      selectedFiles={wizardState.imageFiles || {}}
      imageUrls={wizardState.imageUrls}
      isUploadingImages={wizardState.isUploadingImages}
      libraryId={libraryId}
      sourceFolderId={sourceFolderId}
      onChangeSelectedFiles={(key, file) => {
        setWizardState((prev) => ({
          ...prev,
          imageFiles: {
            ...(prev.imageFiles || {}),
            [key]: file,
          },
          isUploadingImages: {
            ...(prev.isUploadingImages || {}),
            [key]: file !== null,
          },
        }))
      }}
      onUploadComplete={(key, url) => {
        setWizardState((prev) => {
          const isMultiple = imageFields.find((f) => f.key === key)?.multiple
          const existing = prev.imageUrls?.[key]

          // Array-Felder: URL an bestehendes Array anhängen
          let newValue: string | string[]
          if (isMultiple) {
            const arr = Array.isArray(existing) ? existing : (typeof existing === 'string' && existing ? [existing] : [])
            newValue = [...arr, url]
          } else {
            newValue = url
          }

          const newImageUrls = {
            ...(prev.imageUrls || {}),
            [key]: newValue,
          }
          const baseMetadata = prev.draftMetadata || prev.reviewedFields || prev.generatedDraft?.metadata || {}
          const updatedMetadata = {
            ...baseMetadata,
            ...newImageUrls,
          }
          return {
            ...prev,
            imageUrls: newImageUrls,
            draftMetadata: updatedMetadata,
            reviewedFields: prev.reviewedFields ? {
              ...prev.reviewedFields,
              ...newImageUrls,
            } : prev.reviewedFields,
            isUploadingImages: {
              ...(prev.isUploadingImages || {}),
              [key]: false,
            },
          }
        })
      }}
      onRemoveArrayImage={(key, index) => {
        setWizardState((prev) => {
          const existing = prev.imageUrls?.[key]
          if (!Array.isArray(existing)) return prev

          const updated = existing.filter((_, i) => i !== index)
          const newImageUrls = {
            ...(prev.imageUrls || {}),
            [key]: updated,
          }
          const baseMetadata = prev.draftMetadata || prev.reviewedFields || prev.generatedDraft?.metadata || {}
          const updatedMetadata = {
            ...baseMetadata,
            ...newImageUrls,
          }
          return {
            ...prev,
            imageUrls: newImageUrls,
            draftMetadata: updatedMetadata,
            reviewedFields: prev.reviewedFields ? {
              ...prev.reviewedFields,
              ...newImageUrls,
            } : prev.reviewedFields,
          }
        })
      }}
    />
  )
}
