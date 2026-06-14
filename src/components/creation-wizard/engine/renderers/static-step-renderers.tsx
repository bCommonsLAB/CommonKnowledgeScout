/**
 * Reine Anzeige-Step-Renderer der Wizard-Engine (Sub-Welle 3-VI-d / U1):
 * Willkommen + Abschluss. Verbatim aus `creation-wizard.tsx` herausgelöst.
 */

import type { ReactNode } from "react"
import { WelcomeStep } from "../../steps/welcome-step"
import { CompletionStep } from "../../steps/completion-step"
import type { StepRenderContext, StepRenderer } from "../step-render-context"

export function renderWelcomeStep(ctx: StepRenderContext): ReactNode {
  const { template, creation, currentStep } = ctx
  const fallbackTitle = creation.ui?.displayName || template.name || "Vorlage"
  const welcomeMarkdown =
    creation.welcome?.markdown?.trim()
      ? creation.welcome.markdown
      : `## Willkommen\n\nHier erstellen wir gemeinsam **${fallbackTitle}**.\n\n- Du wählst eine Methode (erzählen, Webseite, Text, Datei oder Formular)\n- Wir erstellen einen ersten Vorschlag\n- Du prüfst kurz und speicherst\n`

  return <WelcomeStep title={currentStep.title || "Willkommen"} markdown={welcomeMarkdown} />
}

export const renderCompletionStep: StepRenderer = () => <CompletionStep />
