import type { WizardAntworten } from "@/lib/library-setup/wizard-antworten"

/** Gemeinsame Props der Wizard-Schritte (C2). */
export interface SchrittProps {
  antworten: WizardAntworten
  setze: (patch: Partial<WizardAntworten>) => void
}
