/**
 * Konsistenz-Pruefung Inhaltstyp ↔ Vorlage (F11).
 *
 * Wird beim Speichern der Settings (use-secretary-service-form) und als
 * Live-Hinweis in der Experten-Auswahl (secretary-advanced-form) genutzt.
 * Regeln:
 * - '' (leer)            → ok: Standard-Vorlage des Inhaltstyps, dynamisch.
 * - standard-<typ>       → ok, wenn Typ passt; sonst ERROR (harte Inkonsistenz).
 * - Mongo-Vorlage        → ERROR bei detailViewType-Mismatch; WARN, wenn
 *                          Pflichtfelder der Registry fehlen oder die Vorlage
 *                          keinen detailViewType traegt.
 * - unbekannter Name     → WARN (Verarbeitung schlaegt fehl, bis sie existiert).
 */

import {
  getDefaultTemplateNameForViewType,
  isBuiltinDefaultTemplateName,
} from './default-templates'
import { validateTemplateForViewType } from '@/lib/detail-view-types/validation'

export interface KnownTemplateMeta {
  name: string
  detailViewType?: string
  fieldKeys: string[]
  builtin?: boolean
}

export interface TemplateConsistencyResult {
  level: 'ok' | 'warn' | 'error'
  message: string
}

export function checkTemplateConsistency(args: {
  templateName: string | undefined | null
  viewType: string
  knownTemplates: KnownTemplateMeta[]
}): TemplateConsistencyResult {
  const { viewType, knownTemplates } = args
  const templateName = (args.templateName ?? '').trim()

  // Leer = automatischer Standard des Inhaltstyps — immer konsistent.
  if (templateName === '') {
    return { level: 'ok', message: `Automatisch: Standard-Vorlage für „${viewType}“.` }
  }

  // Fest gewaehlte Standard-Vorlage: muss zum Inhaltstyp passen.
  if (isBuiltinDefaultTemplateName(templateName)) {
    const expected = getDefaultTemplateNameForViewType(viewType)
    if (templateName.toLowerCase() === expected.toLowerCase()) {
      return { level: 'ok', message: 'Standard-Vorlage passt zum Inhaltstyp.' }
    }
    return {
      level: 'error',
      message: `Die Vorlage „${templateName}“ gehört zu einem anderen Inhaltstyp. Passend wäre „${expected}“ — oder das Feld leer lassen (automatisch).`,
    }
  }

  const known = knownTemplates.find(
    t => t.name.toLowerCase() === templateName.toLowerCase()
  )

  if (!known) {
    return {
      level: 'warn',
      message: `Vorlage „${templateName}“ wurde nicht gefunden — die Verarbeitung schlägt fehl, bis sie existiert.`,
    }
  }

  // Harte Inkonsistenz: Vorlage deklariert einen anderen Inhaltstyp.
  if (known.detailViewType && known.detailViewType !== viewType) {
    return {
      level: 'error',
      message: `Die Vorlage „${known.name}“ erzeugt den Inhaltstyp „${known.detailViewType}“, die Bibliothek erwartet aber „${viewType}“.`,
    }
  }

  // Pflichtfeld-Abdeckung gegen die Registry pruefen.
  const validation = validateTemplateForViewType(known.fieldKeys, viewType)
  if (!validation.isValid) {
    return {
      level: 'warn',
      message: `Experten-Vorlage „${known.name}“: Pflichtfelder für „${viewType}“ fehlen (${validation.missingRequired.join(', ')}) — Detailansichten können unvollständig bleiben.`,
    }
  }

  if (!known.detailViewType) {
    return {
      level: 'warn',
      message: `Vorlage „${known.name}“ deklariert keinen Inhaltstyp — Konsistenz nicht garantiert.`,
    }
  }

  return { level: 'ok', message: `Vorlage „${known.name}“ passt zum Inhaltstyp „${viewType}“.` }
}
