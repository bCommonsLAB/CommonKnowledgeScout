/**
 * Auto-Reparatur (Welle A1) — reine Patch-Berechnung.
 *
 * Reparierbar sind AUSSCHLIESSLICH deterministische Normalisierungen
 * (`unnormalized-value`): z.B. Komma-String → String-Array, numerischer String →
 * Zahl, umschliessende Anfuehrungszeichen entfernen. NIEMALS werden fehlende
 * Pflichtwerte „erfunden" (kein stiller Default, siehe no-silent-fallbacks.mdc) —
 * solche Befunde bleiben fuer die manuelle Korrektur stehen.
 *
 * Die Funktion ist storage-frei: sie liefert nur den Feld-Patch. Das Persistieren
 * uebernimmt der `LibraryDocumentSource`-Adapter.
 */

import { coerceToFacetType } from './value-coercion'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type {
  DocumentIssue,
  DocumentVerificationResult,
  VerifiableDocument,
} from './types'

export interface RepairPlan {
  /** Feld → normalisierter Wert (flach, wie docMetaJson). */
  patch: Record<string, unknown>
  /** Felder, die normalisiert wurden. */
  fixedFields: string[]
  /** Befunde, die NICHT automatisch behoben werden konnten. */
  remainingIssues: DocumentIssue[]
}

/**
 * Berechnet den Reparatur-Patch fuer ein Dokument anhand seiner Befunde.
 * @param doc       Das (ungepatchte) Dokument.
 * @param result    Pruefergebnis aus `checkDocument`.
 * @param facetDefs Facetten-Definitionen (fuer den Ziel-Typ je Feld).
 */
export function computeRepairPlan(
  doc: VerifiableDocument,
  result: DocumentVerificationResult,
  facetDefs: FacetDef[]
): RepairPlan {
  const typeByKey = new Map(facetDefs.map((d) => [d.metaKey, d.type] as const))
  const patch: Record<string, unknown> = {}
  const fixedFields: string[] = []
  const remainingIssues: DocumentIssue[] = []

  for (const issue of result.issues) {
    const field = issue.field
    const facetType = field ? typeByKey.get(field) : undefined

    if (!issue.autoFixable || !field || !facetType) {
      remainingIssues.push(issue)
      continue
    }

    const coerced = coerceToFacetType(doc.docMetaJson[field], facetType)
    if (coerced && coerced.changed) {
      patch[field] = coerced.value
      fixedFields.push(field)
    } else {
      // Koercion liefert wider Erwarten keine Aenderung → nicht still verschlucken.
      remainingIssues.push(issue)
    }
  }

  return { patch, fixedFields, remainingIssues }
}
