/**
 * @fileoverview Anzeigenamen für erfasste Quellen (Wizard-Summary).
 *
 * @description
 * Reine Projektion von `WizardSource[]` auf menschenlesbare Labels für die
 * Abschluss-Seite des Erfassungs-Wizards ("Quelle: …"). Entkoppelt von UI und
 * Storage, damit testbar. Kein stiller Fallback: ein unbekannter `kind` ist ein
 * Fehler (alle gültigen Werte sind hier explizit abgedeckt).
 *
 * @module lib/creation
 */

import type { WizardSource } from '@/lib/creation/corpus'

/**
 * Liefert einen Anzeigenamen je Quelle:
 * - `file` → Dateiname (z.B. `vortrag.pdf`)
 * - `url`  → die URL
 * - `text` → festes Label `Texteingabe` (kein Dateiname vorhanden)
 *
 * Wirft bei unbekanntem `kind` (no-silent-fallbacks).
 */
export function describeSourceName(source: WizardSource): string {
  switch (source.kind) {
    case 'file':
      return source.fileName && source.fileName.trim().length > 0 ? source.fileName : 'Datei'
    case 'url':
      return source.url && source.url.trim().length > 0 ? source.url : 'Link'
    case 'text':
      return 'Texteingabe'
    default:
      throw new Error(
        `describeSourceName: unbekannter Quelltyp "${String((source as { kind: unknown }).kind)}"`,
      )
  }
}

/**
 * Bildet eine Liste von Quellen auf ihre Anzeigenamen ab. Leere/fehlende Eingabe
 * ergibt eine leere Liste (die Summary blendet den Block dann aus).
 */
export function describeSourceNames(sources: WizardSource[] | undefined): string[] {
  if (!Array.isArray(sources) || sources.length === 0) return []
  return sources.map(describeSourceName)
}
