/**
 * @fileoverview Sammeldateien, die an einer Quelle haengen — und ob sie ueberholt sind (Welle E).
 *
 * @description
 * Nach einer Korrektur am Transkript einer Quelle (Diskussion, Vortrag)
 * geben die Sammeldateien, die sie enthalten, den alten Stand wieder. Hier
 * wird beides beantwortet: WELCHE Sammeldateien (ueber `compositeSources`,
 * vermerkt vom Transformations-Job) und ob ihre Transformationen aelter sind
 * als die Korrektur (`revised_at` der Quelle, dieselbe Regel wie der Badge
 * „ueberholt" im Reiter Korrektur, `transformationUeberholt`).
 *
 * @module shadow-twin
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { getShadowTwinsBySourceIds, readTranscriptRecord, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { findeSammeldateienMitQuelle, setzeSammeldateiQuellen } from '@/lib/repositories/shadow-twin-sammeldatei'

export interface AbhaengigeSammeldatei {
  sourceId: string
  sourceName: string
  parentId: string
  transformationen: Array<{ template: string; sprache: string; stand: string | null; ueberholt: boolean }>
  /** true, wenn mindestens eine Transformation aelter ist als die Korrektur der Quelle. */
  ueberholt: boolean
  /** Sammeldatei ohne Transformation (z. B. Job gescheitert): nichts zu erneuern, aber zu wissen. */
  ohneTransformation: boolean
}

/** Vom Loader nach dem Aufloesen gerufen; wirft bei leerer Kennung (kein stilles Weglassen). */
export async function merkeSammeldateiQuellen(args: {
  libraryId: string
  userEmail: string
  sourceId: string
  sourceName: string
  parentId: string
  quellenIds: readonly string[]
}): Promise<void> {
  if (!Array.isArray(args.quellenIds)) throw new Error('merkeSammeldateiQuellen: quellenIds fehlen — Resolver ohne sourceIds?')
  await setzeSammeldateiQuellen(args)
}

/** Transformationen eines Twin-Dokuments gegen einen Zeitpunkt pruefen (Record-Stand, nicht Dokument-updatedAt). */
export function transformationenGegenStand(doc: ShadowTwinDocument, revisedAt: string | null): AbhaengigeSammeldatei['transformationen'] {
  const zeilen: AbhaengigeSammeldatei['transformationen'] = []
  for (const [template, sprachen] of Object.entries(doc.artifacts?.transformation ?? {})) {
    for (const [sprache, record] of Object.entries(sprachen ?? {})) {
      if (typeof record?.markdown !== 'string') continue
      const stand = typeof record.updatedAt === 'string' ? record.updatedAt : (typeof record.createdAt === 'string' ? record.createdAt : null)
      zeilen.push({ template, sprache, stand, ueberholt: revisedAt !== null && stand !== null && stand < revisedAt })
    }
  }
  return zeilen
}

/** `revised_at` des Transkripts einer Quelle; null ohne Transkript oder ohne Korrektur. */
export async function korrekturStandDerQuelle(libraryId: string, sourceId: string): Promise<string | null> {
  const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [sourceId] })
  const doc = docs.get(sourceId)
  const record = doc ? readTranscriptRecord(doc) : null
  if (!record) return null
  const revised = parseFrontmatter(record.markdown).meta['revised_at']
  return typeof revised === 'string' && revised.trim() !== '' ? revised : null
}

/**
 * Alle Sammeldateien mit dieser Quelle, je mit Vorlage, Sprache und dem
 * Befund ueberholt. `revisedAt` weglassen = aus dem Transkript der Quelle lesen.
 */
export async function abhaengigeSammeldateien(args: {
  libraryId: string
  sourceId: string
  revisedAt?: string | null
}): Promise<AbhaengigeSammeldatei[]> {
  const revisedAt = args.revisedAt === undefined ? await korrekturStandDerQuelle(args.libraryId, args.sourceId) : args.revisedAt
  const docs = await findeSammeldateienMitQuelle(args.libraryId, args.sourceId)
  return docs.map((doc) => {
    const transformationen = transformationenGegenStand(doc, revisedAt)
    return {
      sourceId: doc.sourceId, sourceName: doc.sourceName, parentId: doc.parentId, transformationen,
      ueberholt: transformationen.some((t) => t.ueberholt),
      ohneTransformation: transformationen.length === 0,
    }
  })
}

/** Fuer Listen (korrekturen_lesen): je Quelle die Namen der Sammeldateien, die sie enthalten. */
export async function sammeldateienJeQuelle(libraryId: string, sourceIds: Iterable<string>): Promise<Map<string, string[]>> {
  const ergebnis = new Map<string, string[]>()
  for (const sourceId of new Set(sourceIds)) {
    const docs = await findeSammeldateienMitQuelle(libraryId, sourceId)
    ergebnis.set(sourceId, docs.map((d) => d.sourceName))
  }
  return ergebnis
}
