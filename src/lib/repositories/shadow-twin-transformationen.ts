/**
 * @fileoverview Transformationen EINER Vorlage lesen, mit Projektion (Welle S1).
 *
 * @description
 * Die Sitzungs-Sichten (`Organisation/SITZUNGEN.md`, Block „Sitzungen" je
 * `BERICHT.md`) brauchen von jedem Twin nur Quelle, Elternordner und das
 * Frontmatter EINER Transformation (z. B. `chatverlauf-de`/`de`). Darum eine
 * Aggregation mit Projektion wie `findKorrekturKandidaten` — NICHT
 * `getAllShadowTwins`, das laedt alle Artefakte samt Markdown.
 * Eigene Datei neben `shadow-twin-repo.ts` (200-Zeilen-Regel).
 *
 * @module repositories
 */

import { getShadowTwinCollection } from './shadow-twin-repo'

/** Eine Transformation der gesuchten Vorlage, auf das Noetige projiziert. */
export interface TransformationZeile {
  sourceId: string
  sourceName: string
  parentId: string
  /** Frontmatter der Transformation; null = Record ohne Frontmatter. */
  frontmatter: Record<string, unknown> | null
  /** `updatedAt` der Transformation; null = fehlt im Record. */
  updatedAt: string | null
}

interface TransformationRoh {
  sourceId?: unknown
  sourceName?: unknown
  parentId?: unknown
  frontmatter?: unknown
  updatedAt?: unknown
}

/** Vorlagen- und Sprachname bilden einen Mongo-Feldpfad — Punkt und `$` waeren dort Syntax. */
function pruefeFeldname(wert: string, was: string): void {
  if (wert.trim() === '') throw new Error(`findeTransformationenNachVorlage: ${was} fehlt`)
  if (/[.$]/.test(wert)) throw new Error(`findeTransformationenNachVorlage: ${was} "${wert}" darf weder "." noch "$" enthalten`)
}

function alsString(wert: unknown): string | null {
  return typeof wert === 'string' && wert !== '' ? wert : null
}

function zeileAus(roh: TransformationRoh): TransformationZeile {
  const sourceId = alsString(roh.sourceId)
  if (sourceId === null) throw new Error('findeTransformationenNachVorlage: Twin-Dokument ohne sourceId')
  const frontmatter =
    roh.frontmatter !== null && typeof roh.frontmatter === 'object' && !Array.isArray(roh.frontmatter)
      ? (roh.frontmatter as Record<string, unknown>)
      : null
  return {
    sourceId,
    sourceName: alsString(roh.sourceName) ?? '',
    parentId: alsString(roh.parentId) ?? '',
    frontmatter,
    updatedAt: alsString(roh.updatedAt),
  }
}

/**
 * Alle Twins der Library, die eine Transformation `template`/`language`
 * tragen — je eine Zeile mit Quelle, Elternordner, Frontmatter, updatedAt.
 * Reihenfolge nach `sourceName`, damit Laeufe reproduzierbar sind.
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
          frontmatter: `$${pfad}.frontmatter`,
          updatedAt: `$${pfad}.updatedAt`,
        },
      },
      { $sort: { sourceName: 1 } },
    ])
    .toArray()
  return rohe.map(zeileAus)
}
