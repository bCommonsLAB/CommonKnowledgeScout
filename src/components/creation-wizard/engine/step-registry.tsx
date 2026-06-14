/**
 * Step-Registry der datengetriebenen Wizard-Engine (Sub-Welle 3-VI-d / U1).
 *
 * Ersetzt schrittweise den großen `renderStep`-Switch im Monolithen
 * `creation-wizard.tsx` durch eine Tabelle `preset -> Renderer` (Strangler-
 * Migration). Presets, die hier (noch) NICHT eingetragen sind, rendert der
 * Wizard-Kern weiterhin über den Legacy-Switch — so bleibt jeder Schritt
 * verhaltenstreu und einzeln prüfbar.
 *
 * Bewusst rein und seiteneffektfrei: ein Renderer baut nur ein React-Element
 * aus dem `StepRenderContext` und ruft KEINE Hooks auf.
 *
 * @see docs/creation-wizard/ux-anforderungen.md (B2: feste Default-Labels)
 * @see docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md (Sub-Welle d)
 */

import type { ReactNode } from "react"
import type { CreationFlowStepPreset } from "@/lib/templates/template-types"
import { WelcomeStep } from "../steps/welcome-step"
import { CompletionStep } from "../steps/completion-step"
import type { StepRenderContext } from "./step-render-context"

/** Ein Renderer baut aus dem Kontext das React-Element des Steps. */
export type StepRenderer = (ctx: StepRenderContext) => ReactNode

function renderWelcomeStep(ctx: StepRenderContext): ReactNode {
  const { template, creation, currentStep } = ctx
  const fallbackTitle = creation.ui?.displayName || template.name || "Vorlage"
  const welcomeMarkdown =
    creation.welcome?.markdown?.trim()
      ? creation.welcome.markdown
      : `## Willkommen\n\nHier erstellen wir gemeinsam **${fallbackTitle}**.\n\n- Du wählst eine Methode (erzählen, Webseite, Text, Datei oder Formular)\n- Wir erstellen einen ersten Vorschlag\n- Du prüfst kurz und speicherst\n`

  return <WelcomeStep title={currentStep.title || "Willkommen"} markdown={welcomeMarkdown} />
}

const renderCompletionStep: StepRenderer = () => <CompletionStep />

/**
 * Bereits auf die Engine migrierte Presets. Fehlt ein Preset hier, übernimmt
 * der Legacy-Switch im Wizard-Kern (schrittweise Ablösung).
 */
const STEP_RENDERERS: Partial<Record<CreationFlowStepPreset, StepRenderer>> = {
  welcome: renderWelcomeStep,
  completion: renderCompletionStep,
}

/** Ist dieses Preset bereits auf die Engine migriert? */
export function isStepMigrated(preset: CreationFlowStepPreset): boolean {
  return preset in STEP_RENDERERS
}

/**
 * Rendert einen migrierten Step. Liefert `undefined`, wenn das Preset (noch)
 * nicht migriert ist — der Aufrufer fällt dann auf den Legacy-Switch zurück.
 */
export function renderRegisteredStep(
  preset: CreationFlowStepPreset,
  ctx: StepRenderContext
): ReactNode | undefined {
  const renderer = STEP_RENDERERS[preset]
  return renderer ? renderer(ctx) : undefined
}
