/**
 * Reine X/Y-Compute-Entscheidung des Creation-Wizards (U5, Entscheidung 2Y).
 *
 * Beantwortet EINE Frage off-target: Wie wird eine erfasste Quelle berechnet,
 * ohne je das Owner-Archiv zu berühren?
 *
 * - `'text-sync'`  → reiner **Text/URL**: synchron über
 *   `POST /api/secretary/process-text` (berührt KEIN Storage — schon off-target).
 *   Das Ergebnis fließt direkt in die Submission (kein External-Job).
 * - `'inbox-job'`  → **Datei-Medien** (PDF/Audio/Office/…): asynchron über die
 *   external-jobs-Pipeline mit `providerScope='inbox'`. Die Quelle liegt als
 *   `binaryRef` in der Inbox (NIE im Owner-Archiv); das Transform-Ergebnis fließt
 *   bei Job-Completion in die Submission zurück.
 *
 * Zweck: die heute im Monolithen verstreuten `if (templateId === 'pdfanalyse' | …)`-
 * Sonderfälle durch EINE datengetriebene Regel ersetzen (ADR-0003: keine
 * Template-ID-Hartverdrahtung) und so die beiden Compute-Pfade versöhnen.
 *
 * Reine Funktion, wirft bei unbekanntem Quelltyp (no-silent-fallbacks). Die
 * Verdrahtung in den Wizard erfolgt in U5c (Datei-Medien); hier liegt der
 * getestete Vertrag, auf dem U5b/U5c aufsetzen.
 *
 * @see docs/wizards/umbauplan-generischer-erfassungs-wizard.md (U5)
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import type { WizardSource } from '@/lib/creation/corpus'

/** Off-target-Berechnungsweg einer Wizard-Quelle (U5). */
export type WizardComputeMode = 'text-sync' | 'inbox-job'

/** Minimaler Quell-Ausschnitt für die Entscheidung (entkoppelt von UI/Storage). */
export type ComputeModeSource = Pick<WizardSource, 'kind'>

/**
 * Compute-Weg einer EINZELNEN Quelle. Reiner Text/URL läuft synchron
 * (`text-sync`), Datei-Medien über die Inbox-Pipeline (`inbox-job`).
 * Wirft bei unbekanntem `kind` (no-silent-fallbacks).
 */
export function resolveComputeMode(source: ComputeModeSource): WizardComputeMode {
  switch (source.kind) {
    case 'text':
    case 'url':
      return 'text-sync'
    case 'file':
      return 'inbox-job'
    default:
      throw new Error(
        `resolveComputeMode: unbekannter Quelltyp "${String((source as { kind: unknown }).kind)}"`,
      )
  }
}
