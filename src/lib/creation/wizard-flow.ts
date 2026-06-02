/**
 * Reine Entscheidungslogik des Creation-Wizards.
 *
 * Diese Funktionen sind aus dem Monolithen `creation-wizard.tsx` herausgelöste,
 * seiteneffektfreie Kernregeln (Step-Filter, `canProceed`, Renderer-Auflösung)
 * plus zwei Vertrags-Helfer (Feld-Auswahl, Kompatibilitätsprüfung). Sie bilden
 * die testbare Naht für die generische Merge-Runtime aus ADR-0003 (Phase 3a):
 * heute spiegeln sie das Ist-Verhalten 1:1, damit Charakter-Tests Regressionen
 * der Umstellung fangen.
 *
 * @see docs/adr/0003-wizard-schema-template-trennen.md
 * @see docs/refactor/welle-3-vi-creation-wizard/phase-2-test-library.md (§5.3)
 */

import type {
  CreationFlowStepRef,
  CreationFlowStepPreset,
} from '@/lib/templates/template-types'

/**
 * Sichtbare Steps eines Flows. Spiegelt `creation-wizard.tsx` (Step-Filter):
 * - `collectSource` entfällt, wenn ein Quell-Ordner gesetzt ist UND der Flow
 *   ohnehin einen `selectFolderArtifacts`-Step hat (sonst bliebe kein Textschritt).
 * - `selectFolderArtifacts` und `generateDraft` erscheinen nur mit Quell-Ordner.
 */
export function filterWizardSteps(
  rawSteps: CreationFlowStepRef[],
  opts: { sourceFolderId?: string } = {}
): CreationFlowStepRef[] {
  const { sourceFolderId } = opts
  const hasSelectFolderArtifactsStep = rawSteps.some(
    (s) => s.preset === 'selectFolderArtifacts'
  )
  return rawSteps.filter((s) => {
    if (s.preset === 'collectSource' && sourceFolderId && hasSelectFolderArtifactsStep) return false
    if (s.preset === 'selectFolderArtifacts' && !sourceFolderId) return false
    if (s.preset === 'generateDraft' && !sourceFolderId) return false
    return true
  })
}

/**
 * Zustand, den `canProceedFromStep` zur Entscheidung braucht. Bewusst flach und
 * UI-frei gehalten (keine React-/Storage-Abhängigkeit), damit testbar.
 */
export interface WizardProceedContext {
  isExtracting?: boolean
  sourcesCount: number
  /** Meldung des CollectSourceStep, dass weitergegangen werden darf. */
  collectSourceCanProceed?: boolean
  /** Legacy-Eingabe (vor Multi-Source). */
  hasCollectedInput?: boolean
  draftText?: string
  hasConfirmedMarkdown?: boolean
  mode?: 'interview' | 'form'
  hasGeneratedDraft?: boolean
  isPublishing?: boolean
  isPublished?: boolean
}

/**
 * Darf der „Weiter"-Button im aktuellen Step klickbar sein?
 * Spiegelt die `canProceed`-Switch-Logik aus `creation-wizard.tsx` 1:1.
 */
export function canProceedFromStep(
  preset: CreationFlowStepPreset,
  ctx: WizardProceedContext
): boolean {
  switch (preset) {
    case 'welcome':
      return true
    case 'collectSource':
      if (ctx.isExtracting) return false
      if (ctx.sourcesCount > 0) return true
      if (ctx.collectSourceCanProceed) return true
      return !!ctx.hasCollectedInput
    case 'reviewMarkdown':
      if (ctx.isExtracting) return false
      if (!ctx.draftText || ctx.draftText.trim().length === 0) return false
      return !!ctx.hasConfirmedMarkdown
    case 'generateDraft':
      if (ctx.mode === 'interview') return !!ctx.hasGeneratedDraft
      return true
    case 'editDraft':
      return true
    case 'uploadImages':
      return true
    case 'selectRelatedTestimonials':
      return true
    case 'selectFolderArtifacts':
      return ctx.sourcesCount > 0
    case 'previewDetail':
      return true
    case 'completion':
      return true
    case 'publish':
      if (ctx.isPublishing) return false
      return !!ctx.isPublished
    default:
      return false
  }
}

/** Vom Wizard-Preview heute unterstützte Renderer (4 von 8 — siehe Drift unten). */
export type WizardPreviewViewType = 'book' | 'session' | 'testimonial' | 'blog'

const WIZARD_PREVIEW_VIEW_TYPES: readonly WizardPreviewViewType[] = [
  'book',
  'session',
  'testimonial',
  'blog',
]

function isWizardPreviewViewType(v: unknown): v is WizardPreviewViewType {
  return typeof v === 'string' && WIZARD_PREVIEW_VIEW_TYPES.includes(v as WizardPreviewViewType)
}

/**
 * Renderer-Auflösung des Wizard-Previews. Spiegelt `resolveTemplateDetailViewType`
 * aus `creation-wizard.tsx`.
 *
 * **Bekannte Drift (ADR-0003)**: Der Wizard-Preview kennt nur 4 der 8 Typen aus
 * `VIEW_TYPE_REGISTRY` und fällt für alle übrigen (z.B. `refurbedDevice`) still
 * auf `'session'` zurück. Phase 3a ersetzt das durch die geteilte Registry.
 */
export function resolveWizardPreviewViewType(template: {
  metadata?: { detailViewType?: string }
  creation?: { preview?: { detailViewType?: string } }
}): WizardPreviewViewType {
  const metaDvt = template.metadata?.detailViewType
  if (isWizardPreviewViewType(metaDvt)) return metaDvt
  const legacy = template.creation?.preview?.detailViewType
  if (isWizardPreviewViewType(legacy)) return legacy
  return 'session'
}

/**
 * Welche Schema-Felder der `editDraft`-Step anzeigt. Spiegelt den Filter aus
 * `edit-draft-step.tsx`: liegt eine `userRelevantFields`-Liste vor, werden die
 * Schema-Felder darauf eingeschränkt (in **Schema**-Reihenfolge), sonst alle.
 *
 * Hinweis: unbekannte Namen in `userRelevantFields` werden hier **still
 * verworfen** — genau der Silent-Fallback, den die Kompatibilitätsprüfung
 * (siehe unten) in Phase 3a durch einen klaren Fehler ersetzt.
 */
export function selectEditableFields(
  schemaFieldKeys: string[],
  userRelevantFields?: string[]
): string[] {
  if (userRelevantFields && userRelevantFields.length > 0) {
    return schemaFieldKeys.filter((k) => userRelevantFields.includes(k))
  }
  return schemaFieldKeys
}

/** Ergebnis der Wizard↔Schema-Kompatibilitätsprüfung. */
export interface WizardSchemaCompatibility {
  ok: boolean
  /** `editDraft`-Felder, die im Schema fehlen (heute still verworfen). */
  missingFields: string[]
}

/**
 * Prüft, ob alle von `editDraft`-Steps gebundenen Felder im Schema existieren.
 * Ersetzt konzeptionell den heutigen Silent-Fallback (ADR-0003): ein Wizard, der
 * ein nicht vorhandenes Feld bindet, soll früh und klar scheitern statt das Feld
 * stillschweigend zu schlucken.
 */
export function checkWizardSchemaCompatibility(
  steps: CreationFlowStepRef[],
  schemaFieldKeys: string[]
): WizardSchemaCompatibility {
  const known = new Set(schemaFieldKeys)
  const missing = new Set<string>()
  for (const step of steps) {
    if (step.preset !== 'editDraft') continue
    for (const field of step.fields ?? []) {
      if (!known.has(field)) missing.add(field)
    }
  }
  const missingFields = [...missing]
  return { ok: missingFields.length === 0, missingFields }
}
