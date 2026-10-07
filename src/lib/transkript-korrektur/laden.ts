/**
 * @fileoverview Transkript und Begleittexte fuer den Reiter „Korrektur" laden (P3b).
 *
 * @description
 * Liest die fuehrende Fassung aus MongoDB (`shadow-twin-repo`), nie aus dem
 * Spiegel. Der Zustand (`transkriptZustand`) ist, was die Oberflaeche braucht,
 * um Listen vorzubelegen und den optimistischen Riegel (`updatedAt`) zu
 * setzen; der Body selbst geht nur an den Secretary, nicht an den Client.
 *
 * @module transkript-korrektur
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { TransformationZeile } from '@/lib/mcp/transkript-korrektur-typen'
import {
  getShadowTwinsBySourceIds,
  readTranscriptRecord,
  type ShadowTwinArtifactRecord,
  type ShadowTwinDocument,
} from '@/lib/repositories/shadow-twin-repo'
import { parseSpeakerNames, sprecherPraefix } from './anwenden'
import { transformationenVon } from './schreiben'

export interface TranskriptStand {
  doc: ShadowTwinDocument
  record: ShadowTwinArtifactRecord
  meta: Record<string, unknown>
  body: string
}

/** Zustand fuer die Oberflaeche — ohne den Body. */
export interface TranskriptZustand {
  sourceId: string
  sourceName: string
  /** Riegel fuer `apply`: muss beim Schreiben noch gleich sein. */
  updatedAt: string
  speakers: string[]
  speakerNames: string[]
  revisedAt: string | null
  revisedBy: string | null
  revisionNote: string | null
  /** true, wenn mindestens ein Label als Praefix im Body steht. */
  hatPraefixe: boolean
  zeichen: number
  transformationen: TransformationZeile[]
  /** true, wenn das Transkript nach mindestens einer Transformation korrigiert wurde (abgeleitet, kein Feld). */
  ueberholt: boolean
}

/** Juengster Stand je Transformations-Record — unabhaengig vom Dokument-`updatedAt`, das jeder Write bewegt. */
export function transformationUeberholt(doc: ShadowTwinDocument, revisedAt: string | null): boolean {
  if (!revisedAt) return false
  for (const sprachen of Object.values(doc.artifacts?.transformation ?? {})) {
    for (const record of Object.values(sprachen ?? {})) {
      if (typeof record?.markdown !== 'string') continue
      const stand = typeof record.updatedAt === 'string' ? record.updatedAt : record.createdAt
      if (typeof stand === 'string' && stand < revisedAt) return true
    }
  }
  return false
}

function stringListe(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : []
}

function textOderNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Transkript-Familie einer Quelle; null, wenn es keine Familie oder kein Transkript gibt. */
export async function ladeTranskript(args: { libraryId: string; sourceId: string }): Promise<TranskriptStand | null> {
  const docs = await getShadowTwinsBySourceIds({ libraryId: args.libraryId, sourceIds: [args.sourceId] })
  const doc = docs.get(args.sourceId)
  if (!doc) return null
  const record = readTranscriptRecord(doc)
  if (!record) return null
  const { meta, body } = parseFrontmatter(record.markdown)
  return { doc, record, meta, body }
}

export function transkriptZustand(stand: TranskriptStand): TranskriptZustand {
  const { doc, record, meta, body } = stand
  const speakers = stringListe(meta['speakers'])
  const revisedAt = textOderNull(meta['revised_at'])
  return {
    sourceId: doc.sourceId,
    sourceName: doc.sourceName,
    updatedAt: record.updatedAt,
    speakers,
    speakerNames: [...parseSpeakerNames(meta['speaker_names']).entries()].map(([l, n]) => `${l}: ${n}`),
    revisedAt,
    revisedBy: textOderNull(meta['revised_by']),
    revisionNote: textOderNull(meta['revision_note']),
    hatPraefixe: speakers.some((label) => body.includes(sprecherPraefix(label))),
    zeichen: body.length,
    transformationen: transformationenVon(doc, ''),
    ueberholt: transformationUeberholt(doc, revisedAt),
  }
}

export interface Begleittext {
  name: string
  text: string
}

/**
 * Transkripte der Begleitquellen (Einladung, Folien) — Body ohne Frontmatter.
 * Fehlt eines, ist das ein Fehler mit Namen, kein stilles Weglassen.
 */
export async function ladeBegleittexte(args: { libraryId: string; sourceIds: string[] }): Promise<Begleittext[]> {
  if (args.sourceIds.length === 0) return []
  const docs = await getShadowTwinsBySourceIds({ libraryId: args.libraryId, sourceIds: args.sourceIds })
  const fehlend: string[] = []
  const texte: Begleittext[] = []
  for (const sourceId of args.sourceIds) {
    const doc = docs.get(sourceId)
    const record = doc ? readTranscriptRecord(doc) : null
    if (!doc || !record) {
      fehlend.push(sourceId)
      continue
    }
    texte.push({ name: doc.sourceName, text: parseFrontmatter(record.markdown).body })
  }
  if (fehlend.length > 0) {
    throw new Error(`Begleitdokumente ohne Transkript: ${fehlend.join(', ')} — zuerst transkribieren oder abwaehlen`)
  }
  return texte
}
