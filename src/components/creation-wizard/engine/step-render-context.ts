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

import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from "react"
import type { TemplateDocument, CreationFlowStepRef } from "@/lib/templates/template-types"
import type { WizardSource } from "@/lib/creation/corpus"
import type { WizardSessionEvent } from "@/types/wizard-session"
import type { WizardState } from "./wizard-state"

/** Narrowter Creation-Block — nach dem Guard im Wizard immer vorhanden. */
export type WizardCreation = NonNullable<TemplateDocument["creation"]>

/** Storage-Provider-Typ exakt wie aus `useStorage` (ohne den internen Typ zu exportieren). */
export type WizardStorageProvider = ReturnType<typeof import("@/contexts/storage-context").useStorage>["provider"]

/** Logging-Funktion des Wizards (best-effort, blockiert den Wizard nicht). */
export type LogWizardEvent = (
  sessionId: string,
  event: Omit<WizardSessionEvent, "eventId" | "timestamp">
) => Promise<void>

export interface StepRenderContext {
  template: TemplateDocument
  creation: WizardCreation
  currentStep: CreationFlowStepRef
  libraryId: string
  templateId: string
  /** Veränderlicher Wizard-State (1:1 wie im Kern; Sub-Welle 3-VI-c ersetzt ihn durch Atoms). */
  wizardState: WizardState
  setWizardState: Dispatch<SetStateAction<WizardState>>
  provider: WizardStorageProvider
  currentFolderId?: string
  /** Bereits gesammelte Quellen (Multi-Source). */
  sources: WizardSource[]
  /** Seed-Datei (z. B. Dialograum/Event), falls der Wizard damit gestartet wurde. */
  seedFileIdState?: string
  /** Quell-Ordner-Kontext (nur Folder-Flows). */
  sourceFolderId?: string
  /** Vorwärts-Navigation (handleNext) — von Steps mit Auto-Advance genutzt. */
  onNext: () => void
  /** Aktuelle Wizard-Session-ID (best-effort Logging). */
  wizardSessionIdRef: MutableRefObject<string | null>
  logWizardEvent: LogWizardEvent
  /** Auswahl-Handler des selectRelatedTestimonials-Steps (stabiler Callback). */
  onTestimonialSelectionChange: (sources: WizardSource[]) => void
  /** Auswahl-Handler des selectFolderArtifacts-Steps (stabiler Callback). */
  onFolderArtifactSelectionChange: (sources: WizardSource[]) => void
}

/** Ein Renderer baut aus dem Kontext das React-Element des Steps (ohne Hooks). */
export type StepRenderer = (ctx: StepRenderContext) => ReactNode
