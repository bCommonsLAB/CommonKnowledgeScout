/**
 * Kontext für die datengetriebene Step-Engine des Creation-Wizards
 * (Sub-Welle 3-VI-d / U1). Wird im Wizard-Kern einmal pro Render zusammengebaut
 * und an den zum Preset passenden Renderer übergeben.
 *
 * Das Interface wächst beim schrittweisen Herauslösen weiterer Steps
 * (Strangler-Migration): Es enthält genau die Daten/Handler, die bereits
 * migrierte Renderer benötigen — nicht mehr. So bleibt die Naht klein und
 * jeder Migrationsschritt einzeln per `tsc` prüfbar.
 *
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle d)
 */

import type { TemplateDocument, CreationFlowStepRef } from "@/lib/templates/template-types"
import type { WizardSource } from "@/lib/creation/corpus"

/** Narrowter Creation-Block — nach dem Guard im Wizard immer vorhanden. */
export type WizardCreation = NonNullable<TemplateDocument["creation"]>

export interface StepRenderContext {
  template: TemplateDocument
  creation: WizardCreation
  currentStep: CreationFlowStepRef
  libraryId: string
  /** Bereits gesammelte Quellen (Multi-Source). */
  sources: WizardSource[]
  /** Seed-Datei (z. B. Dialograum/Event), falls der Wizard damit gestartet wurde. */
  seedFileIdState?: string
  /** Quell-Ordner-Kontext (nur Folder-Flows). */
  sourceFolderId?: string
  /** Auswahl-Handler des selectRelatedTestimonials-Steps (stabiler Callback). */
  onTestimonialSelectionChange: (sources: WizardSource[]) => void
  /** Auswahl-Handler des selectFolderArtifacts-Steps (stabiler Callback). */
  onFolderArtifactSelectionChange: (sources: WizardSource[]) => void
}
