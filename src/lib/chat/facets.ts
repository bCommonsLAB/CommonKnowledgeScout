import type { FacetDef } from './dynamic-facets'
import { getTopLevelValue } from './dynamic-facets'

// DEPRECATED: FacetKey Type wird nicht mehr verwendet
// Verwende stattdessen FacetDef[] aus dynamic-facets.ts
export type FacetKey = string // Erlaubt jetzt beliebige Facetten-Keys

export interface FacetMappingConfig {
  keys: FacetKey[]
}

function toStringArray(input: unknown, limit = 50, maxLen = 128): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((v) => (typeof v === 'string' ? v : String(v)))
    .filter((v) => v.length > 0)
    .slice(0, limit)
    .map((v) => (v.length > maxLen ? v.slice(0, maxLen) : v))
}

/**
 * @deprecated Verwende stattdessen getTopLevelValue aus dynamic-facets.ts mit FacetDef[]
 * Extrahiert Facetten-Werte aus Metadaten basierend auf Facetten-Definitionen
 */
export function extractTopLevelFacetsFromMeta(
  meta: Record<string, unknown> | undefined,
  defs: FacetDef[]
): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {}
  const out: Record<string, unknown> = {}

  for (const def of defs) {
    const value = getTopLevelValue(meta, def)
    if (value !== undefined) {
      out[def.metaKey] = value
    }
  }
  return out
}

/**
 * Erstellt Dokument-Zusammenfassungstext dynamisch basierend auf Facetten-Definitionen
 * @param meta Metadaten-Objekt
 * @param defs Facetten-Definitionen (optional, falls nicht vorhanden werden Standard-Felder verwendet)
 */
export function composeDocSummaryText(
  meta: Record<string, unknown> | undefined,
  defs?: FacetDef[]
): string | null {
  if (!meta || typeof meta !== 'object') return null
  const title = typeof (meta as { title?: unknown }).title === 'string' ? (meta as { title: string }).title : undefined
  const shortTitle = typeof (meta as { shortTitle?: unknown }).shortTitle === 'string' ? (meta as { shortTitle: string }).shortTitle : undefined
  const summary = typeof (meta as { summary?: unknown }).summary === 'string' ? (meta as { summary: string }).summary : undefined

  const parts: string[] = []
  if (title) parts.push(`Titel: ${title}`)
  if (shortTitle) parts.push(`Kurz: ${shortTitle}`)
  
  // Dynamisch alle String/String[] Facetten hinzufügen (falls defs vorhanden)
  if (defs && defs.length > 0) {
    for (const def of defs) {
      if (def.type === 'string[]') {
        const value = getTopLevelValue(meta, def)
        if (Array.isArray(value) && value.length > 0) {
          const label = def.label || def.metaKey
          const displayValues = (value as string[]).slice(0, 10).join(', ')
          parts.push(`${label}: ${displayValues}`)
        }
      } else if (def.type === 'string') {
        const value = getTopLevelValue(meta, def)
        if (typeof value === 'string' && value.length > 0) {
          const label = def.label || def.metaKey
          parts.push(`${label}: ${value}`)
        }
      }
    }
  } else {
    // Fallback: Hardcodierte Felder für Rückwärtskompatibilität
    const authors = toStringArray((meta as { authors?: unknown }).authors).slice(0, 10)
    const tags = toStringArray((meta as { tags?: unknown }).tags).slice(0, 10)
    if (authors.length > 0) parts.push(`Autoren: ${authors.join(', ')}`)
    if (tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`)
  }
  
  if (summary) parts.push(`Zusammenfassung: ${summary}`)
  const text = parts.join('\n')
  return text.length > 0 ? text : null
}


