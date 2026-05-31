/**
 * @fileoverview External-Job Phase: phase-doc-relations (Quelle A, Welle 4).
 *
 * @description
 * Katalogweiter LLM-Pass, der gerichtete, gewichtete „Supports"-Kanten einer
 * Library berechnet und in `doc_relations__<libraryId>` ablegt (Zielbild §5.5).
 * Eigene Domäne `external-jobs` (ADR 0001), bewusst OHNE Storage/Secretary-
 * Datei-Pfad — analog zu `phase-translations`: lädt Katalog aus Mongo, ruft das
 * LLM, validiert slug→fileId und schreibt atomar zurück.
 *
 * Zwei Granularitäten (job.correlation.options.scope):
 *  - `source`  → ersetzt nur die ausgehenden Kanten EINER Maßnahme.
 *  - `library` → ersetzt ALLE Kanten der Library.
 *
 * Keine Silent Fallbacks: unbekannte slug-Referenzen werden im Job-Trace
 * protokolliert (nicht still verworfen); Dokumente ohne slug fließen sichtbar
 * nicht in den Katalog ein.
 *
 * @module external-jobs/phase-doc-relations
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { LibraryService } from '@/lib/services/library-service'
import { getCollectionNameForLibrary, findDocs } from '@/lib/repositories/vector-repo'
import { callLlmJson } from '@/lib/chat/common/llm'
import { computeCatalogHash } from '@/lib/gallery/relations-staleness'
import {
  replaceEdgesForSource,
  replaceAllEdgesForLibrary,
  type DocRelationEdge,
} from '@/lib/repositories/doc-relations-repo'
import {
  buildRelationsMessages,
  relationsSchemaJson,
  RelationsResultSchema,
  type RelationsCatalogEntry,
} from './doc-relations-prompt'
import type { ExternalJob } from '@/types/external-job'

const DEFAULT_RELATION_TYPE = 'unterstuetzt'
const DEFAULT_MODEL = 'gpt-4.1-mini'
const CATALOG_LIMIT = 500

interface DocRelationsOptions {
  phase?: string
  scope?: 'source' | 'library'
  sourceFileId?: string
  relationType?: string
  relationPrompt?: string
  model?: string
}

export interface DocRelationsPhaseResult {
  scope: 'source' | 'library'
  catalogSize: number
  edgesProposed: number
  edgesWritten: number
  unknownSlugs: number
}

/** Begrenzt einen Wert deterministisch auf `0..1` (kein Silent Fallback auf 0). */
function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export async function runDocRelationsPhase(job: ExternalJob): Promise<DocRelationsPhaseResult> {
  const repo = new ExternalJobsRepository()
  const opts = (job.correlation?.options || {}) as DocRelationsOptions
  const scope: 'source' | 'library' = opts.scope === 'source' ? 'source' : 'library'
  const relationType = opts.relationType || DEFAULT_RELATION_TYPE
  const model = opts.model || DEFAULT_MODEL

  await repo.updateStep(job.jobId, 'phase-doc-relations', { status: 'running', startedAt: new Date() })

  // ── 1) Library + Katalog laden ───────────────────────────────────────────
  const library = await LibraryService.getInstance().getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-doc-relations: Library nicht gefunden')
  const libraryKey = getCollectionNameForLibrary(library)

  const { items } = await findDocs(libraryKey, job.libraryId, {}, { limit: CATALOG_LIMIT })

  // slug→fileId-Brücke: Dokumente ohne slug können nicht referenziert werden.
  const slugToFileId = new Map<string, string>()
  const catalog: RelationsCatalogEntry[] = []
  const hashEntries: Array<{ fileId: string; updatedAt?: string }> = []
  for (const d of items) {
    const fileId = d.fileId || d.id
    if (fileId) hashEntries.push({ fileId, updatedAt: d.upsertedAt })
    if (!d.slug || !fileId) continue
    slugToFileId.set(d.slug, fileId)
    catalog.push({ slug: d.slug, title: d.title || d.slug, summary: d.summary })
  }
  const catalogHash = computeCatalogHash(hashEntries)

  // Fokus-slug (nur bei scope='source') aus der fileId auflösen.
  let focusSlug: string | undefined
  if (scope === 'source') {
    if (!opts.sourceFileId) throw new Error('phase-doc-relations: sourceFileId fehlt (scope=source)')
    focusSlug = catalog.find((c) => slugToFileId.get(c.slug) === opts.sourceFileId)?.slug
    if (!focusSlug) throw new Error('phase-doc-relations: Quell-Dokument nicht im Katalog (slug fehlt?)')
  }

  // ── 2) LLM-Pass ──────────────────────────────────────────────────────────
  const messages = buildRelationsMessages({
    catalog, relationType, relationPrompt: opts.relationPrompt, focusSlug,
  })
  const { data } = await callLlmJson(
    {
      apiKey: library.config?.publicPublishing?.apiKey,
      model,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
      messages,
    },
    RelationsResultSchema,
    relationsSchemaJson,
  )

  // ── 3) slug→fileId auflösen + gegen Katalog validieren ───────────────────
  const computedAt = new Date()
  const computedBy = model
  const edges: DocRelationEdge[] = []
  const unknownSlugs = new Set<string>()
  for (const e of data.edges) {
    const sourceFileId = slugToFileId.get(e.sourceSlug)
    const targetFileId = slugToFileId.get(e.targetSlug)
    if (!sourceFileId) { unknownSlugs.add(e.sourceSlug); continue }
    if (!targetFileId) { unknownSlugs.add(e.targetSlug); continue }
    if (sourceFileId === targetFileId) continue // keine Selbstkanten
    if (scope === 'source' && sourceFileId !== opts.sourceFileId) continue
    edges.push({
      libraryId: job.libraryId,
      sourceFileId,
      targetFileId,
      sourceSlug: e.sourceSlug,
      targetSlug: e.targetSlug,
      weight: clampWeight(e.weight),
      rationale: e.rationale,
      relationType,
      computedAt,
      computedBy,
      catalogHash,
    })
  }

  // Unbekannte Referenzen protokollieren (kein Silent Fallback, §5.4).
  if (unknownSlugs.size > 0) {
    await repo.traceAddEvent(job.jobId, {
      spanId: 'job',
      name: 'doc_relations_unknown_slugs',
      level: 'warn',
      message: `${unknownSlugs.size} unbekannte slug-Referenzen verworfen`,
      attributes: { slugs: [...unknownSlugs].slice(0, 50) },
    })
  }

  // ── 4) Atomar ersetzen (Zielbild §5.5) ───────────────────────────────────
  const written = scope === 'source'
    ? await replaceEdgesForSource(job.libraryId, opts.sourceFileId as string, edges)
    : await replaceAllEdgesForLibrary(job.libraryId, edges)

  await repo.updateStep(job.jobId, 'phase-doc-relations', {
    status: 'completed',
    endedAt: new Date(),
    details: { scope, catalogSize: catalog.length, edgesWritten: written.inserted, unknownSlugs: unknownSlugs.size },
  })
  await repo.setStatus(job.jobId, 'completed')

  return {
    scope,
    catalogSize: catalog.length,
    edgesProposed: data.edges.length,
    edgesWritten: written.inserted,
    unknownSlugs: unknownSlugs.size,
  }
}
