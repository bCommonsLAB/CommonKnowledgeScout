/**
 * @fileoverview Artefakt einer Quelle aus dem Twin-Dokument waehlen (Welle G): reine Funktion.
 *
 * @description
 * `artefakt_lesen` liefert Transkript oder Transformation aus MongoDB, ohne
 * Spiegel — auch in Libraries ohne Filesystem-Persistierung. Die Auswahl
 * ist deterministisch (shadow-twin-contracts §1): Transkript ist
 * sprach-neutral; eine Transformation braucht die Sprache, und mit `vorlage`
 * genau diese Vorlage. Ohne `vorlage` gewinnt die juengste Transformation
 * der Sprache (wie `selectShadowTwinArtifact`), die Antwort nennt sie. Ein
 * Fehlgriff nennt, was es stattdessen gibt — kein stilles null.
 *
 * @module mcp
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { readTranscriptRecord, type ShadowTwinArtifactRecord, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'

export type ArtefaktArt = 'transkript' | 'transformation'

export interface ArtefaktSicht {
  art: ArtefaktArt
  sprache: string | null
  vorlage: string | null
  erstellt: string
  aktualisiert: string
  frontmatter: Record<string, unknown>
  /** Frontmatter-Felder, deren Wert auf die Feldgrenze gekuerzt wurde (Befund T5). */
  frontmatterGekuerzt: string[]
  /** Body ohne Frontmatter; mit `ohneFrontmatter: false` das ganze Markdown. */
  text: string
  zeichen: number
  gekuerzt: boolean
}

/** Was am Twin haengt — fuer Fehlermeldungen und die Uebersicht. */
export function artefaktUebersicht(doc: ShadowTwinDocument): { transkript: boolean; transformationen: Array<{ vorlage: string; sprache: string }> } {
  const transformationen: Array<{ vorlage: string; sprache: string }> = []
  for (const [vorlage, sprachen] of Object.entries(doc.artifacts?.transformation ?? {})) {
    for (const [sprache, record] of Object.entries(sprachen ?? {})) {
      if (typeof record?.markdown === 'string') transformationen.push({ vorlage, sprache })
    }
  }
  return { transkript: readTranscriptRecord(doc) !== null, transformationen }
}

function record(doc: ShadowTwinDocument, art: ArtefaktArt, sprache: string, vorlage?: string): { record: ShadowTwinArtifactRecord; sprache: string | null; vorlage: string | null } {
  const uebersicht = artefaktUebersicht(doc)
  const vorhanden = uebersicht.transformationen.map((t) => `${t.vorlage}/${t.sprache}`).join(', ') || 'keine'
  if (art === 'transkript') {
    const r = readTranscriptRecord(doc)
    if (!r) throw new Error(`Kein Transkript am Twin von "${doc.sourceName}" — Transformationen: ${vorhanden}`)
    return { record: r, sprache: null, vorlage: null }
  }
  if (vorlage) {
    const r = doc.artifacts?.transformation?.[vorlage]?.[sprache]
    if (!r || typeof r.markdown !== 'string') {
      throw new Error(`Keine Transformation "${vorlage}" (${sprache}) am Twin von "${doc.sourceName}" — vorhanden: ${vorhanden}`)
    }
    return { record: r, sprache, vorlage }
  }
  const gewaehlt = selectShadowTwinArtifact(doc, 'transformation', sprache)
  if (!gewaehlt) throw new Error(`Keine Transformation (${sprache}) am Twin von "${doc.sourceName}" — vorhanden: ${vorhanden}`)
  return { record: gewaehlt.record, sprache, vorlage: gewaehlt.templateName ?? null }
}

/** Obergrenze je Frontmatter-Feld: summary mit 10 000 Zeichen kam vorher ungekuerzt (T5). */
const FELD_MAX = 1000

/** Lange Feldwerte kuerzen — Strings direkt, alles andere als JSON-Text. Nennt die Felder. */
export function kuerzeFrontmatter(meta: Record<string, unknown>, grenze: number): { meta: Record<string, unknown>; gekuerzt: string[] } {
  const gekuerzt: string[] = []
  const aus: Record<string, unknown> = {}
  for (const [key, wert] of Object.entries(meta)) {
    const text = typeof wert === 'string' ? wert : JSON.stringify(wert)
    if (typeof text === 'string' && text.length > grenze) {
      aus[key] = `${text.slice(0, grenze)}… [${text.length} Zeichen]`
      gekuerzt.push(key)
    } else {
      aus[key] = wert
    }
  }
  return { meta: aus, gekuerzt }
}

export function waehleArtefakt(args: {
  doc: ShadowTwinDocument
  art: ArtefaktArt
  sprache: string
  vorlage?: string
  ohneFrontmatter: boolean
  maxZeichen: number
}): ArtefaktSicht {
  const { record: r, sprache, vorlage } = record(args.doc, args.art, args.sprache, args.vorlage)
  const { meta, body } = parseFrontmatter(r.markdown)
  const voll = args.ohneFrontmatter ? body : r.markdown
  const gekuerzt = voll.length > args.maxZeichen
  const kurz = kuerzeFrontmatter(meta, Math.min(args.maxZeichen, FELD_MAX))
  return {
    art: args.art, sprache, vorlage, erstellt: r.createdAt, aktualisiert: r.updatedAt,
    frontmatter: kurz.meta, frontmatterGekuerzt: kurz.gekuerzt, text: gekuerzt ? voll.slice(0, args.maxZeichen) : voll, zeichen: voll.length, gekuerzt,
  }
}
