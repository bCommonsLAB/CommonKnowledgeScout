/**
 * @fileoverview Pure Migrations-Logik fuer Mongo-Shadow-Twin-Dokumente.
 *
 * Friert in einem Shadow-Twin-Dokument alle Markdown-Artefakte (transcript + transformation)
 * deterministisch ein, indem relative Bildpfade via `binaryFragments` durch absolute URLs
 * ersetzt werden.
 *
 * Frei von I/O — getestet als Unit, verwendet im Migrations-Skript.
 */

import { freezeMarkdownImageUrls } from './media-persistence-service'
import type { BinaryFragmentLookupFields } from './binary-fragment-lookup'

export interface MigrateDocumentImagesStats {
  sourceId: string
  artifactsScanned: number
  artifactsChanged: number
  totalReplacements: number
  unresolved: string[]
}

export interface MigrateDocumentImagesResult {
  changed: boolean
  newDoc: Record<string, unknown>
  stats: MigrateDocumentImagesStats
}

/**
 * Wendet `freezeMarkdownImageUrls` auf alle Markdown-Felder eines Shadow-Twin-Dokuments an.
 * Liefert ein neues Dokument plus Statistik.
 */
export function migrateDocumentImages(doc: Record<string, unknown>): MigrateDocumentImagesResult {
  const sourceId = String(doc.sourceId ?? '?')
  const fragments = (doc.binaryFragments as BinaryFragmentLookupFields[] | undefined) ?? []

  const stats: MigrateDocumentImagesStats = {
    sourceId,
    artifactsScanned: 0,
    artifactsChanged: 0,
    totalReplacements: 0,
    unresolved: [],
  }

  const artifacts = (doc.artifacts ?? {}) as Record<string, unknown>
  const newArtifacts: Record<string, unknown> = {}
  let changed = false

  for (const [topKey, topVal] of Object.entries(artifacts)) {
    if (topKey === 'transcript') {
      const langs = (topVal ?? {}) as Record<string, unknown>
      const newLangs: Record<string, unknown> = {}
      for (const [lang, recRaw] of Object.entries(langs)) {
        const rec = recRaw as Record<string, unknown>
        const md = typeof rec?.markdown === 'string' ? rec.markdown : null
        if (md) {
          stats.artifactsScanned++
          const r = freezeMarkdownImageUrls(md, fragments)
          if (r.replacedCount > 0) {
            stats.artifactsChanged++
            stats.totalReplacements += r.replacedCount
            changed = true
            newLangs[lang] = { ...rec, markdown: r.markdown }
          } else {
            newLangs[lang] = rec
          }
          stats.unresolved.push(...r.unresolved)
        } else {
          newLangs[lang] = rec
        }
      }
      newArtifacts[topKey] = newLangs
    } else if (topKey === 'transformation') {
      const templates = (topVal ?? {}) as Record<string, unknown>
      const newTemplates: Record<string, unknown> = {}
      for (const [tmpl, langsRaw] of Object.entries(templates)) {
        const langs = (langsRaw ?? {}) as Record<string, unknown>
        const newLangs: Record<string, unknown> = {}
        for (const [lang, recRaw] of Object.entries(langs)) {
          const rec = recRaw as Record<string, unknown>
          const md = typeof rec?.markdown === 'string' ? rec.markdown : null
          if (md) {
            stats.artifactsScanned++
            const r = freezeMarkdownImageUrls(md, fragments)
            if (r.replacedCount > 0) {
              stats.artifactsChanged++
              stats.totalReplacements += r.replacedCount
              changed = true
              newLangs[lang] = { ...rec, markdown: r.markdown }
            } else {
              newLangs[lang] = rec
            }
            stats.unresolved.push(...r.unresolved)
          } else {
            newLangs[lang] = rec
          }
        }
        newTemplates[tmpl] = newLangs
      }
      newArtifacts[topKey] = newTemplates
    } else {
      newArtifacts[topKey] = topVal
    }
  }

  const newDoc = changed ? { ...doc, artifacts: newArtifacts, updatedAt: new Date().toISOString() } : doc
  return { changed, newDoc, stats }
}
