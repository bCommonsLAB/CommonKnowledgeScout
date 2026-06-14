/**
 * Pro-Dokument-Pruefung (Welle A1) — reine Funktion, storage-agnostisch.
 *
 * Prueft ein Dokument gegen drei Achsen:
 *  1. Basis-Felder (base-fields.ts) — der gemeinsame Nenner jeder Library.
 *  2. Pflichtfelder seines aufgeloesten DetailViewType (Registry).
 *  3. Facetten-Stimmigkeit — vorhandene Werte muessen zum konfigurierten Typ passen.
 *
 * Wiederverwendung statt Eigenbau: `missingBaseFields`, `validateMetadataForViewType`,
 * `getTopLevelValue`/`FacetDef` und die gemeinsame `coerceToFacetType` (s. A1-Engine).
 */

import {
  isBaseRequiredField,
  missingBaseFields,
} from '@/lib/detail-view-types/base-fields'
import { isValidDetailViewType } from '@/lib/detail-view-types/registry'
import { validateMetadataForViewType } from '@/lib/detail-view-types/validation'
import { isTechnicalField } from '@/lib/detail-view-types/content-fields'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import { coerceToFacetType } from './value-coercion'
import type {
  DocumentIssue,
  DocumentVerificationResult,
  VerifiableDocument,
} from './types'

export interface DocumentCheckContext {
  /** Library-weiter Default-DetailViewType (config.chat.gallery.detailViewType). */
  libraryDetailViewType?: string
  /** Konfigurierte Facetten-Definitionen (inkl. erzwungener Basis-Facetten). */
  facetDefs: FacetDef[]
}

/** Wert gilt als „vorhanden", wenn nicht leer/null/undefined (wie validation.ts). */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

/**
 * Loest den effektiven DetailViewType eines Dokuments auf:
 * per-Dokument (`docMetaJson.detailViewType`) hat Vorrang, sonst Library-Default.
 * Kein stiller Fallback: ist nichts Gueltiges bestimmbar, entsteht ein Befund.
 */
export function resolveDetailViewType(
  docMetaJson: Record<string, unknown>,
  libraryDetailViewType: string | undefined
): { viewType?: string; issues: DocumentIssue[] } {
  const issues: DocumentIssue[] = []
  const perDoc = docMetaJson.detailViewType

  if (typeof perDoc === 'string' && perDoc.trim() !== '') {
    if (isValidDetailViewType(perDoc)) return { viewType: perDoc, issues }
    issues.push({
      code: 'invalid-detail-view-type',
      severity: 'error',
      field: 'detailViewType',
      message: `Unbekannter detailViewType „${perDoc}".`,
      autoFixable: false,
    })
  }

  if (libraryDetailViewType && isValidDetailViewType(libraryDetailViewType)) {
    return { viewType: libraryDetailViewType, issues }
  }

  issues.push({
    code: 'undetermined-detail-view-type',
    severity: 'error',
    field: 'detailViewType',
    message: 'Inhaltstyp nicht bestimmbar (weder am Dokument noch als Library-Default gueltig).',
    autoFixable: false,
  })
  return { viewType: undefined, issues }
}

function checkBaseFields(present: Set<string>): DocumentIssue[] {
  return missingBaseFields([...present]).map((field) => ({
    code: 'missing-base-field',
    severity: 'error',
    field,
    message: `Verbindliches Basis-Feld fehlt: ${field}.`,
    autoFixable: false,
  }))
}

function checkRequiredFields(
  docMetaJson: Record<string, unknown>,
  viewType: string
): DocumentIssue[] {
  const result = validateMetadataForViewType(docMetaJson, viewType)
  // Basis-Felder werden separat geprueft → hier ausklammern (kein Doppelbefund).
  return result.missingRequired
    .filter((field) => !isBaseRequiredField(field))
    .map((field) => ({
      // Technische Felder (language/targetLanguage/slug/docType) setzt die
      // Pipeline automatisch — fehlend = Warnung, kein harter Datenmangel.
      code: 'missing-required-field' as const,
      severity: isTechnicalField(field) ? ('warning' as const) : ('error' as const),
      field,
      message: `Pflichtfeld fuer „${viewType}" fehlt: ${field}.`,
      autoFixable: false,
    }))
}

function checkFacetConsistency(
  docMetaJson: Record<string, unknown>,
  facetDefs: FacetDef[]
): DocumentIssue[] {
  const issues: DocumentIssue[] = []
  for (const def of facetDefs) {
    const raw = docMetaJson[def.metaKey]
    if (raw === undefined) continue // fehlende Werte deckt die Pflichtfeld-Pruefung ab
    const coerced = coerceToFacetType(raw, def.type)
    if (coerced === null) {
      issues.push({
        code: 'facet-type-mismatch',
        severity: 'error',
        field: def.metaKey,
        message: `Facette „${def.metaKey}" hat einen mit Typ „${def.type}" unvereinbaren Wert.`,
        autoFixable: false,
      })
    } else if (coerced.changed) {
      issues.push({
        code: 'unnormalized-value',
        severity: 'warning',
        field: def.metaKey,
        message: `Facette „${def.metaKey}" ist nicht normalisiert (Typ „${def.type}").`,
        autoFixable: true,
      })
    }
  }
  return issues
}

/** Prueft ein einzelnes Dokument und liefert ein strukturiertes Ergebnis. */
export function checkDocument(
  doc: VerifiableDocument,
  ctx: DocumentCheckContext
): DocumentVerificationResult {
  const docMetaJson = doc.docMetaJson ?? {}
  const present = new Set(Object.keys(docMetaJson).filter((k) => hasValue(docMetaJson[k])))

  const { viewType, issues: typeIssues } = resolveDetailViewType(
    docMetaJson,
    ctx.libraryDetailViewType
  )

  const issues: DocumentIssue[] = [
    ...typeIssues,
    ...checkBaseFields(present),
    ...(viewType ? checkRequiredFields(docMetaJson, viewType) : []),
    ...checkFacetConsistency(docMetaJson, ctx.facetDefs),
  ]

  return {
    fileId: doc.fileId,
    fileName: doc.fileName,
    detailViewType: viewType,
    issues,
    ok: issues.length === 0,
  }
}
