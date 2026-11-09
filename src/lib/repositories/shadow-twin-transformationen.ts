/**
 * @fileoverview Transformationen EINER Vorlage lesen, mit Projektion (Welle S1).
 *
 * @description
 * Die Sitzungs-Sichten (`Organisation/SITZUNGEN.md`, Block „Sitzungen" je
 * `BERICHT.md`) brauchen von jedem Twin nur Quelle, Elternordner, das
 * Frontmatter EINER Transformation (z. B. `chatverlauf-de`/`de`) und den
 * gemerkten Beleg-Kopf (`sourceFrontmatter`, S1b). Darum eine Aggregation
 * mit Projektion wie `findKorrekturKandidaten` — NICHT `getAllShadowTwins`,
 * das laedt alle Artefakte samt Markdown. Eigene Datei neben
 * `shadow-twin-repo.ts` (200-Zeilen-Regel).
 *
 * @module repositories
 */

import { getShadowTwinCollection } from './shadow-twin-repo'

/** Gemerkter Kopf der Quelldatei (siehe `ShadowTwinDocument.sourceFrontmatter`). */
export interface QuellFrontmatter {
  fields: Record<string, unknown>
  sourceModifiedAt: string | null
}

/** Eine Transformation der gesuchten Vorlage, auf das Noetige projiziert. */
export interface TransformationZeile {
  sourceId: string
  sourceName: string
  parentId: string
  /** Frontmatter der Transformation; null = Record ohne Frontmatter. */
  frontmatter: Record<string, unknown> | null
  /** `updatedAt` der Transformation; null = fehlt im Record. */
  updatedAt: string | null
  /** Beleg-Kopf aus dem Merker; null = noch nie gelesen. */
  sourceFrontmatter: QuellFrontmatter | null
}

interface TransformationRoh {
  sourceId?: unknown
  sourceName?: unknown
  parentId?: unknown
  frontmatter?: unknown
  updatedAt?: unknown
  sourceFrontmatter?: unknown
}

/** Vorlagen- und Sprachname bilden einen Mongo-Feldpfad — Punkt und `$` waeren dort Syntax. */
function pruefeFeldname(wert: string, was: string): void {
  if (wert.trim() === '') throw new Error(`findeTransformationenNachVorlage: ${was} fehlt`)
  if (/[.$]/.test(wert)) throw new Error(`findeTransformationenNachVorlage: ${was} "${wert}" darf weder "." noch "$" enthalten`)
}

function alsString(wert: unknown): string | null {
  return typeof wert === 'string' && wert !== '' ? wert : null
}

function alsObjekt(wert: unknown): Record<string, unknown> | null {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : null
}

function quellFrontmatterAus(roh: unknown): QuellFrontmatter | null {
  const o = alsObjekt(roh)
  const fields = o ? alsObjekt(o.fields) : null
  if (!o || !fields) return null
  return { fields, sourceModifiedAt: alsString(o.sourceModifiedAt) }
}

function zeileAus(roh: TransformationRoh): TransformationZeile {
  const sourceId = alsString(roh.sourceId)
  if (sourceId === null) throw new Error('findeTransformationenNachVorlage: Twin-Dokument ohne sourceId')
  return {
    sourceId,
    sourceName: alsString(roh.sourceName) ?? '',
    parentId: alsString(roh.parentId) ?? '',
    frontmatter: alsObjekt(roh.frontmatter),
    updatedAt: alsString(roh.updatedAt),
    sourceFrontmatter: quellFrontmatterAus(roh.sourceFrontmatter),
  }
}

/**
 * Alle Twins der Library, die eine Transformation `template`/`language`
 * tragen — je eine Zeile mit Quelle, Elternordner, Frontmatter, updatedAt,
 * Beleg-Kopf. Reihenfolge nach `sourceName`, damit Laeufe reproduzierbar sind.
 */
export async function findeTransformationenNachVorlage(args: {
  libraryId: string
  template: string
  language: string
}): Promise<TransformationZeile[]> {
  pruefeFeldname(args.template, 'Vorlage')
  pruefeFeldname(args.language, 'Sprache')
  const pfad = `artifacts.transformation.${args.template}.${args.language}`
  const col = await getShadowTwinCollection(args.libraryId)
  const rohe = await col
    .aggregate<TransformationRoh>([
      { $match: { libraryId: args.libraryId, [pfad]: { $exists: true } } },
      {
        $project: {
          _id: 0,
          sourceId: 1,
          sourceName: 1,
          parentId: 1,
          sourceFrontmatter: 1,
          frontmatter: `$${pfad}.frontmatter`,
          updatedAt: `$${pfad}.updatedAt`,
        },
      },
      { $sort: { sourceName: 1 } },
    ])
    .toArray()
  return rohe.map(zeileAus)
}

/**
 * Merkt den Kopf der Quelldatei am Twin (S1b). Setzt `updatedAt` wie jeder
 * Schreibweg; ein Twin, den es nicht gibt, ist ein Fehler — der Merker legt
 * keine Dokumente an.
 */
export async function setzeQuellFrontmatter(args: {
  libraryId: string
  sourceId: string
  fields: Record<string, unknown>
  sourceModifiedAt: string | null
}): Promise<void> {
  if (!args.sourceId) throw new Error('setzeQuellFrontmatter: sourceId fehlt')
  const col = await getShadowTwinCollection(args.libraryId)
  const now = new Date().toISOString()
  const r = await col.updateOne(
    { libraryId: args.libraryId, sourceId: args.sourceId },
    { $set: { sourceFrontmatter: { fields: args.fields, sourceModifiedAt: args.sourceModifiedAt, readAt: now }, updatedAt: now } },
  )
  if (r.matchedCount === 0) throw new Error(`setzeQuellFrontmatter: kein Twin fuer ${args.sourceId}`)
}
