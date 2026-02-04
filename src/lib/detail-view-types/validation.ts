/**
 * @fileoverview Validierungsfunktionen für DetailViewType-Pflichtfelder
 * 
 * @description
 * Validiert Metadaten gegen die Pflichtfelder eines ViewTypes.
 * Wird verwendet in:
 * - Pipeline (Template-Phase) → Contract-Warnung in job.result.warnings
 * - Vorlagenverwaltung (beim Auswählen des ViewType)
 * - Story-Vorschau (beim Rendern)
 * - Template-Editor (Live-Validierung)
 * 
 * @module detail-view-types
 */

import {
  type DetailViewType,
  VIEW_TYPE_REGISTRY,
  isValidDetailViewType,
} from './registry'

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION RESULT INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ergebnis einer Pflichtfeld-Validierung.
 */
export interface ValidationResult {
  /** true wenn alle Pflichtfelder vorhanden sind */
  isValid: boolean
  /** Liste der fehlenden Pflichtfelder */
  missingRequired: string[]
  /** Liste der fehlenden optionalen Felder (zur Info) */
  missingOptional: string[]
  /** Liste der vorhandenen Felder (für Debugging) */
  presentFields: string[]
  /** Der geprüfte ViewType */
  viewType: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prüft ob ein Feld einen "vorhandenen" Wert hat.
 * Leere Strings, null, undefined gelten als "nicht vorhanden".
 */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

/**
 * Validiert Metadaten gegen die Pflichtfelder eines ViewTypes.
 * 
 * @param metadata - Die zu prüfenden Metadaten (z.B. aus Frontmatter)
 * @param viewType - Der DetailViewType (z.B. 'climateAction')
 * @returns ValidationResult mit fehlenden Feldern
 * 
 * @example
 * ```typescript
 * const result = validateMetadataForViewType(
 *   { title: 'Test', summary: 'Lorem ipsum' },
 *   'climateAction'
 * );
 * // result.isValid = false (category fehlt)
 * // result.missingRequired = ['category']
 * ```
 */
export function validateMetadataForViewType(
  metadata: Record<string, unknown>,
  viewType: string
): ValidationResult {
  // Ungültiger ViewType → nicht valide, aber keine spezifischen Felder
  if (!isValidDetailViewType(viewType)) {
    return {
      isValid: false,
      missingRequired: [],
      missingOptional: [],
      presentFields: [],
      viewType,
    }
  }

  const config = VIEW_TYPE_REGISTRY[viewType as DetailViewType]

  // Alle Felder mit Werten sammeln
  const presentFields = Object.keys(metadata).filter(key => hasValue(metadata[key]))

  // Pflichtfelder prüfen
  const missingRequired = config.requiredFields.filter(field => !presentFields.includes(field))

  // Optionale Felder prüfen (nur zur Info)
  const missingOptional = config.optionalFields.filter(field => !presentFields.includes(field))

  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    presentFields,
    viewType,
  }
}

/**
 * Prüft ob ein Template die Pflichtfelder für einen ViewType definiert.
 * Wird in der Vorlagenverwaltung verwendet, um Warnungen anzuzeigen
 * wenn das Template nicht alle Pflichtfelder für den gewählten ViewType definiert.
 * 
 * @param templateFields - Liste der im Template definierten Felder
 * @param viewType - Der gewählte DetailViewType
 * @returns ValidationResult mit fehlenden Feldern
 * 
 * @example
 * ```typescript
 * const result = validateTemplateForViewType(
 *   ['title', 'summary', 'tags'],
 *   'climateAction'
 * );
 * // result.isValid = false (category fehlt im Template)
 * // result.missingRequired = ['category']
 * ```
 */
export function validateTemplateForViewType(
  templateFields: string[],
  viewType: string
): ValidationResult {
  // Ungültiger ViewType → nicht valide
  if (!isValidDetailViewType(viewType)) {
    return {
      isValid: false,
      missingRequired: [],
      missingOptional: [],
      presentFields: [],
      viewType,
    }
  }

  const config = VIEW_TYPE_REGISTRY[viewType as DetailViewType]

  // Pflichtfelder prüfen
  const missingRequired = config.requiredFields.filter(field => !templateFields.includes(field))

  // Optionale Felder prüfen
  const missingOptional = config.optionalFields.filter(field => !templateFields.includes(field))

  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    presentFields: templateFields,
    viewType,
  }
}

/**
 * Formatiert eine ValidationResult als lesbare Warnmeldung.
 * Kann in UI-Komponenten und Logs verwendet werden.
 * 
 * @param result - Das Validierungsergebnis
 * @returns Formatierte Warnmeldung oder null wenn valide
 */
export function formatValidationWarning(result: ValidationResult): string | null {
  if (result.isValid) return null

  const missing = result.missingRequired.join(', ')
  return `Fehlende Pflichtfelder für ${result.viewType}: ${missing}`
}
