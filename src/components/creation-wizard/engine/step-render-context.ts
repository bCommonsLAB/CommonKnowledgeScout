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

/** Narrowter Creation-Block — nach dem Guard im Wizard immer vorhanden. */
export type WizardCreation = NonNullable<TemplateDocument["creation"]>

export interface StepRenderContext {
  template: TemplateDocument
  creation: WizardCreation
  currentStep: CreationFlowStepRef
}
