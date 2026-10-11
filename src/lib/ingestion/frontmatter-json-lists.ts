/**
 * @fileoverview Listenfelder, die im Twin-Frontmatter als JSON-Text stehen,
 * beim Ingest als Listen lesen (Welle J1).
 *
 * @description
 * Das Frontmatter ist flach (AGENTS.md): `phase-template.ts` schreibt
 * Listen von Objekten wie `slides` als JSON-String in EINE Zeile. Das ist der
 * Speicher-Vertrag; wer liest, parst. Der Ingest prueft `Array.isArray(slides)`
 * fuer den Session-Modus und die Folienbild-Verarbeitung — mit einem String
 * griff beides nie (Befund 11.10.2026, Plan `bruecke-library-betrieb` §3b).
 *
 * Hier werden gezielt die bekannten Listenfelder geparst, nicht pauschal alle
 * Strings (`normalizeJsonStringValues` wuerde auch eine Zusammenfassung
 * anfassen, die zufaellig mit `[` beginnt). Ein String, der wie JSON aussieht,
 * aber nicht parst, bleibt stehen und wird gemeldet — kein stiller Ersatz.
 *
 * @module ingestion
 */

import { FileLogger } from '@/lib/debug/logger'

/** Felder, die als Liste erwartet werden und als JSON-Text ankommen koennen. */
export const JSON_LIST_FIELDS = ['slides', 'galleryImageUrls', 'attachments_url', 'attachments_names'] as const

export interface JsonListParseResult {
  meta: Record<string, unknown>
  /** Felder, die aus einem JSON-String zu einer Liste wurden. */
  parsed: string[]
  /** Felder, die wie JSON aussahen, aber nicht lesbar waren (bleiben String). */
  fehlerhaft: Array<{ field: string; error: string }>
}

function siehtAusWieJsonListe(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('[') && trimmed.endsWith(']')
}

/**
 * Liefert eine Kopie von `meta`, in der die genannten Felder als Listen
 * vorliegen, sofern sie als JSON-Text ankamen. Listen und andere Werte bleiben
 * unveraendert. Ein JSON-Text, der zu etwas anderem als einer Liste parst,
 * gilt als fehlerhaft und bleibt String.
 */
export function parseJsonListFields(
  meta: Record<string, unknown>,
  fields: readonly string[] = JSON_LIST_FIELDS,
  context?: { fileId?: string },
): JsonListParseResult {
  const out: Record<string, unknown> = { ...meta }
  const parsed: string[] = []
  const fehlerhaft: Array<{ field: string; error: string }> = []

  for (const field of fields) {
    const value = out[field]
    if (typeof value !== 'string' || !siehtAusWieJsonListe(value)) continue
    try {
      const geparst: unknown = JSON.parse(value.trim())
      if (!Array.isArray(geparst)) {
        fehlerhaft.push({ field, error: 'JSON ist keine Liste' })
        continue
      }
      out[field] = geparst
      parsed.push(field)
    } catch (err) {
      fehlerhaft.push({ field, error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (fehlerhaft.length > 0) {
    FileLogger.warn('ingestion', 'Frontmatter-Listenfeld als JSON-Text nicht lesbar — bleibt String', {
      fileId: context?.fileId,
      fehlerhaft,
    })
  }
  if (parsed.length > 0) {
    FileLogger.info('ingestion', 'Frontmatter-Listenfelder aus JSON-Text gelesen', {
      fileId: context?.fileId,
      parsed,
    })
  }
  return { meta: out, parsed, fehlerhaft }
}
