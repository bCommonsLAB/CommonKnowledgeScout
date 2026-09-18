/**
 * @fileoverview Verweis-Audit: Buch 1 (Bericht/Index) gegen Buch 2 (Inventar).
 *
 * @description
 * Loest jeden Verweis eines `BERICHT.md`/`_INDEX.md` gegen das gescannte
 * Inventar auf und meldet die drei Befunde aus F2:
 * - `verweis_tot` — das Ziel gibt es (nicht mehr),
 * - `verweis_veraltet` — das Ziel ist juenger als der Bericht,
 * - `bericht_unvollstaendig` — erschlossene Quellen, die der Bericht nicht nennt.
 *
 * Reine Funktionen, kein I/O, kein LLM.
 *
 * @module agent-view
 */

import type { ArchiveDocEntry } from './archive-types'
import { createGap } from './gap-registry'
import { parseReferences, uniqueReferences } from './reference-parser'
import type { CoverageGap } from './types'

/** Ein aufloesbares Ziel des Inventars. */
export interface InventoryTarget {
  /** Library-relativer Pfad des Ziels. */
  path: string
  name: string
  /** Juengste bekannte Aenderung (Datei-mtime bzw. Twin-`updatedAt`). */
  modifiedAt: string | null
  kind: 'file' | 'folder' | 'twin'
}

/** Nachschlagewerk: mehrere Ziele je Schluessel sind moeglich (gleicher Name). */
export type ReferenceIndex = Map<string, InventoryTarget[]>

function addKey(index: ReferenceIndex, key: string, target: InventoryTarget): void {
  const normalized = key.trim().toLowerCase()
  if (normalized === '') return
  const bucket = index.get(normalized)
  if (bucket) bucket.push(target)
  else index.set(normalized, [target])
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/**
 * Baut den Aufloesungs-Index: je Ziel der volle Pfad, der Dateiname und der
 * Name ohne Endung (Obsidian-Wikilinks nennen Dateien ohne `.md`).
 */
export function buildReferenceIndex(targets: readonly InventoryTarget[]): ReferenceIndex {
  const index: ReferenceIndex = new Map()
  for (const target of targets) {
    addKey(index, target.path, target)
    addKey(index, target.name, target)
    addKey(index, stripExtension(target.name), target)
  }
  return index
}

/** Ordner eines library-relativen Pfades ('' fuer die Wurzel). */
function parentPath(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? '' : path.slice(0, slash)
}

/**
 * Loest ein Verweis-Ziel auf: erst relativ zum Ordner des Dokuments, dann als
 * Pfad ab der Scan-Wurzel, zuletzt ueber den (Datei-)Namen.
 * Mehrdeutige Namen liefern den ersten Treffer nach Pfad-Sortierung —
 * deterministisch, damit der Report reproduzierbar bleibt.
 */
export function resolveReference(
  target: string,
  docPath: string,
  index: ReferenceIndex,
): InventoryTarget | null {
  const base = parentPath(docPath)
  const candidates = [base ? `${base}/${target}` : target, target]
  for (const candidate of candidates) {
    const hits = index.get(candidate.toLowerCase())
    if (hits && hits.length > 0) {
      return [...hits].sort((a, b) => a.path.localeCompare(b.path))[0]
    }
  }
  return null
}

export interface ReferenceAuditArgs {
  doc: ArchiveDocEntry
  folderId: string
  index: ReferenceIndex
  /**
   * Erschlossene Quellen des Vorhabens (Dateiname + Pfad). Fehlt eine davon im
   * Bericht, entsteht `bericht_unvollstaendig` (informativ).
   */
  expectedSources?: ReadonlyArray<{ name: string; path: string }>
  /**
   * Wunschliste 6, B3: Dateien, auf die das Dokument verweist (Tiefe 1, vom
   * Scan mitgelesen). Eine Quelle gilt auch dann als erwaehnt, wenn sie DORT
   * steht — sonst schoebe `bericht_unvollstaendig` die Dateiliste wieder in
   * den Bericht und arbeitete gegen die Laengenregel.
   */
  linkedDocs?: readonly ArchiveDocEntry[]
}

/** Nennt der Text die Quelle — als Verweis-Ziel oder als reine Textnennung? */
function erwaehnt(body: string, source: { name: string; path: string }): boolean {
  const name = source.name.toLowerCase()
  const ziele = new Set(uniqueReferences(parseReferences(body)).map((ref) => ref.target.toLowerCase()))
  if (ziele.has(name) || ziele.has(stripExtension(name)) || ziele.has(source.path.toLowerCase())) return true
  // Auch reine Textnennung zaehlt als „erwaehnt" — der Befund ist informativ.
  const bodyLower = body.toLowerCase()
  return bodyLower.includes(name) || bodyLower.includes(stripExtension(name))
}

/** Fuehrt das Verweis-Audit fuer EIN Dokument aus. */
export function auditReferences(args: ReferenceAuditArgs): CoverageGap[] {
  const { doc, folderId, index } = args
  const gaps: CoverageGap[] = []
  const refs = uniqueReferences(parseReferences(doc.body))
  const docTime = doc.modifiedAt === null ? null : Date.parse(doc.modifiedAt)

  for (const ref of refs) {
    const hit = resolveReference(ref.target, doc.path, index)
    if (!hit) {
      gaps.push(
        createGap({
          type: 'verweis_tot',
          scope: 'folder',
          targetId: doc.fileId,
          targetName: doc.name,
          folderId,
          path: doc.path,
          message: `Der Verweis auf „${ref.target}" zeigt ins Leere`,
          detail: `${ref.syntax}, Anzeigetext „${ref.label}"`,
        }),
      )
      continue
    }
    if (docTime === null || hit.modifiedAt === null) continue
    const hitTime = Date.parse(hit.modifiedAt)
    if (Number.isNaN(hitTime) || Number.isNaN(docTime) || hitTime <= docTime) continue
    gaps.push(
      createGap({
        type: 'verweis_veraltet',
        scope: 'folder',
        targetId: doc.fileId,
        targetName: doc.name,
        folderId,
        path: doc.path,
        message: `„${ref.target}" wurde nach diesem Dokument geaendert — stimmt der Verweis noch?`,
        detail: `Ziel ${hit.modifiedAt} (${hit.kind}), Dokument ${doc.modifiedAt}`,
      }),
    )
  }

  const expected = args.expectedSources ?? []
  if (expected.length > 0) {
    const linkedDocs = args.linkedDocs ?? []
    const ueberVerweis: string[] = []
    const missing = expected.filter((source) => {
      if (erwaehnt(doc.body, source)) return false
      const traeger = linkedDocs.find((linked) => erwaehnt(linked.body, source))
      if (traeger) ueberVerweis.push(`${source.name} (in ${traeger.name})`)
      return traeger === undefined
    })
    if (missing.length > 0) {
      gaps.push(
        createGap({
          type: 'bericht_unvollstaendig',
          scope: 'folder',
          targetId: doc.fileId,
          targetName: doc.name,
          folderId,
          path: doc.path,
          message: `${missing.length} ausgewertete Datei(en) kommen im Text nicht vor`,
          detail:
            missing
              .map((source) => source.name)
              .sort((a, b) => a.localeCompare(b))
              .join(', ') +
            // B3: sichtbar machen, was NICHT fehlt, weil ein Verweis es traegt.
            (ueberVerweis.length > 0
              ? ` — ueber Verweise erwaehnt: ${[...ueberVerweis].sort((a, b) => a.localeCompare(b)).join(', ')}`
              : ''),
        }),
      )
    }
  }

  return gaps
}
