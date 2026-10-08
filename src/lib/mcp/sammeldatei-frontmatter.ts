/**
 * @fileoverview Frontmatter einer neuen Sammeldatei ergaenzen (Welle E): reine Funktion.
 *
 * @description
 * `buildCompositeReference` liefert die Referenz-Markdown mit `kind`,
 * `_source_files` und Medien. Die Bruecke ergaenzt, was der Mensch beim
 * Anlegen entscheidet: `title`, `_include_self` (eigener Text geht als
 * Quelle mit) und zusaetzliche `_media_files`. Geschrieben wird nur ueber
 * den zentralen Serializer, flach, ohne verschachtelte Objekte.
 *
 * @module mcp
 */

import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

export interface SammeldateiZusatz {
  titel?: string
  includeSelf?: boolean
  /** Dateinamen (relativ zum Ordner der Sammeldatei) fuer `_media_files`. */
  medien?: string[]
}

function alsListe(wert: unknown): string[] {
  return Array.isArray(wert) ? wert.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : []
}

export function ergaenzeSammeldateiFrontmatter(markdown: string, zusatz: SammeldateiZusatz): string {
  const { meta, body } = parseFrontmatter(markdown)
  if (meta['kind'] !== 'composite-transcript') {
    throw new Error('Referenz-Markdown ohne kind: composite-transcript — buildCompositeReference hat eine andere Form geliefert')
  }
  // Riegel gegen einen verlustbehafteten Durchlauf: ohne lesbare Quellenliste wird nichts neu serialisiert.
  if (!Array.isArray(meta['_source_files']) || meta['_source_files'].length === 0) {
    throw new Error('Referenz-Markdown ohne lesbare _source_files — Frontmatter waere beim Neuschreiben verloren gegangen')
  }
  const neu: Record<string, unknown> = { ...meta }
  const titel = zusatz.titel?.trim()
  if (titel) neu['title'] = titel
  if (zusatz.includeSelf === true) neu['_include_self'] = true
  const medien = (zusatz.medien ?? []).map((m) => m.trim()).filter(Boolean)
  if (medien.length > 0) {
    const vorhanden = alsListe(meta['_media_files'])
    neu['_media_files'] = [...vorhanden, ...medien.filter((m) => !vorhanden.includes(m))]
  }
  return createMarkdownWithFrontmatter(body, neu)
}
