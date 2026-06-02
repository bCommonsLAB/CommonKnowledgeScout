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
import { getCollectionNameForLibrary, findDocs, findDocSummaries } from '@/lib/repositories/vector-repo'
import { callLlmJson } from '@/lib/chat/common/llm'
import { facetsSelectedToMongoFilter } from '@/lib/chat/common/filters'
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
  DEFAULT_MAX_OUTGOING,
  type RelationsCatalogEntry,
} from './doc-relations-prompt'
import type { ExternalJob } from '@/types/external-job'

const DEFAULT_RELATION_TYPE = 'unterstuetzt'
const DEFAULT_MODEL = 'gpt-4.1-mini'
const CATALOG_LIMIT = 500
/**
 * Obergrenze für den Pro-Maßnahme-Lauf (scope='library' = N fokussierte
 * LLM-Pässe). Schützt vor versehentlich teuren Läufen; für größere Kataloge ist
 * das skalierbare Provides/Requires-Verfahren vorgesehen
 * (docs/architecture/massnahmen-beziehungen-skalierung.md).
 */
const MAX_LIBRARY_FOCUS = 150
/** Feld, dessen Wert generisch als Gruppen-Label dient, wenn `colorField` fehlt. */
const DEFAULT_GROUP_FIELD = 'dominant_perspektive'

interface DocRelationsOptions {
  phase?: string
  scope?: 'source' | 'library'
  sourceFileId?: string
  relationType?: string
  relationPrompt?: string
  model?: string
  /** Aktive Galerie-Facetten-Filter ({ metaKey: string[] }); grenzt den Katalog ein. */
  filters?: Record<string, string[]>
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
  const model = opts.model || DEFAULT_MODEL

  await repo.updateStep(job.jobId, 'phase-doc-relations', { status: 'running', startedAt: new Date() })

  // ── 1) Library + Config + Katalog laden ───────────────────────────────────
  const library = await LibraryService.getInstance().getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-doc-relations: Library nicht gefunden')
  const libraryKey = getCollectionNameForLibrary(library)

  // Config ist Quelle der Wahrheit (Job-Optionen übersteuern nur explizit).
  const graphConfig = library.config?.chat?.gallery?.graph
  const relationsConfig = graphConfig?.edgeSources?.relations
  const relationType = opts.relationType || relationsConfig?.relationType || DEFAULT_RELATION_TYPE
  const relationPrompt = opts.relationPrompt || relationsConfig?.relationPrompt
  // Generisches Gruppen-Label = die kategorische Encoding-Dimension des Graphen
  // (Klima: `dominant_perspektive`). Kein Hardcoding — nur ein Default.
  const groupField = graphConfig?.colorField || DEFAULT_GROUP_FIELD
  const maxOutgoing = graphConfig?.maxEdgesPerNode ?? DEFAULT_MAX_OUTGOING

  // Aktive Galerie-Filter (falls gesetzt) grenzen den Katalog ein: so kann der
  // Nutzer „in Gruppen" analysieren und bleibt unter MAX_LIBRARY_FOCUS. Ohne
  // Filter = ganzer Katalog (bis CATALOG_LIMIT).
  const docFilter = facetsSelectedToMongoFilter(opts.filters)
  const hasFilter = Object.keys(docFilter).length > 0

  const { items } = await findDocs(libraryKey, job.libraryId, docFilter, { limit: CATALOG_LIMIT })

  // Summaries separat laden (nicht Teil von DocCardMeta) und per fileId mergen.
  const summaryRows = await findDocSummaries(libraryKey, job.libraryId, docFilter, { limit: CATALOG_LIMIT }, true)
  const summaryByFileId = new Map<string, string>()
  for (const r of summaryRows) {
    const s = r.summary || r.teaser || r.docSummary
    if (r.fileId && s) summaryByFileId.set(r.fileId, s)
  }

  // slug→fileId-Brücke: Dokumente ohne slug können nicht referenziert werden.
  const slugToFileId = new Map<string, string>()
  const catalog: RelationsCatalogEntry[] = []
  const hashEntries: Array<{ fileId: string; updatedAt?: string }> = []
  for (const d of items) {
    const fileId = d.fileId || d.id
    if (fileId) hashEntries.push({ fileId, updatedAt: d.upsertedAt })
    if (!d.slug || !fileId) continue
    slugToFileId.set(d.slug, fileId)
    const groupRaw = (d as unknown as Record<string, unknown>)[groupField]
    const group = typeof groupRaw === 'string' && groupRaw.length > 0 ? groupRaw : undefined
    catalog.push({ slug: d.slug, title: d.title || d.slug, summary: summaryByFileId.get(fileId), group })
  }
  const catalogHash = computeCatalogHash(hashEntries)

  // Sichtbar im Job-Dokument (trace.events): wie groß ist der (ggf. gefilterte)
  // Katalog und ob ein Filter aktiv war. Hilft beim Diagnostizieren der Grenzen.
  await repo.traceAddEvent(job.jobId, {
    spanId: 'phase-doc-relations',
    name: 'doc_relations_catalog_built',
    level: 'info',
    attributes: {
      scope,
      hasFilter,
      filterKeys: hasFilter ? Object.keys(docFilter) : [],
      loadedDocs: items.length,
      catalogSize: catalog.length,
      catalogLimit: CATALOG_LIMIT,
    },
  }).catch(() => {})

  // Fokus-slug (nur bei scope='source') aus der fileId auflösen.
  let focusSlug: string | undefined
  if (scope === 'source') {
    if (!opts.sourceFileId) throw new Error('phase-doc-relations: sourceFileId fehlt (scope=source)')
    focusSlug = catalog.find((c) => slugToFileId.get(c.slug) === opts.sourceFileId)?.slug
    if (!focusSlug) {
      // Haeufigste Ursache bei großen Katalogen: das Dokument liegt jenseits von
      // CATALOG_LIMIT (Default-Sortierung) ODER hat keinen slug. Filter setzen
      // (Galerie auf eine Gruppe einschraenken) holt es zuverlaessig in den Katalog.
      throw new Error(
        `phase-doc-relations: Quell-Dokument nicht im Katalog ` +
        `(geladen: ${items.length}/${CATALOG_LIMIT}, Filter aktiv: ${hasFilter}). ` +
        `Bei großen Bibliotheken die Galerie auf eine Gruppe filtern und erneut starten.`,
      )
    }
  }

  // ── 2)+3) Fokussierte LLM-Pässe ───────────────────────────────────────────
  // Ein Pass je Maßnahme (focusSlug) liefert deren AUSGEHENDE Kanten. Sowohl
  // scope='source' (1 Pass) als auch scope='library' (N Pässe, gründlich pro
  // Knoten) nutzen denselben fokussierten Pfad. Kein katalogweiter Sammel-Pass
  // mehr (der lieferte pro Knoten zu wenige Kanten).
  const computedAt = new Date()
  const computedBy = model
  const edges: DocRelationEdge[] = []
  const unknownSlugs = new Set<string>()
  let edgesProposed = 0
  // Außerhalb der Closure auslesen (TS-Narrowing von `library` greift dort nicht).
  const apiKey = library.config?.publicPublishing?.apiKey

  async function runFocusPass(passFocusSlug: string, restrictSourceFileId: string): Promise<void> {
    const messages = buildRelationsMessages({
      catalog, relationType, relationPrompt, focusSlug: passFocusSlug, maxOutgoing, groupLabel: groupField,
    })
    const { data } = await callLlmJson(
      {
        apiKey,
        model,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
        messages,
      },
      RelationsResultSchema,
      relationsSchemaJson,
    )
    edgesProposed += data.edges.length
    for (const e of data.edges) {
      const sourceFileId = slugToFileId.get(e.sourceSlug)
      const targetFileId = slugToFileId.get(e.targetSlug)
      if (!sourceFileId) { unknownSlugs.add(e.sourceSlug); continue }
      if (!targetFileId) { unknownSlugs.add(e.targetSlug); continue }
      if (sourceFileId === targetFileId) continue // keine Selbstkanten
      // Nur die ausgehenden Kanten der fokussierten Maßnahme übernehmen.
      if (sourceFileId !== restrictSourceFileId) continue
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
  }

  if (scope === 'source') {
    await runFocusPass(focusSlug as string, opts.sourceFileId as string)
  } else {
    // scope='library': je referenzierbarer Maßnahme EIN fokussierter Pass.
    const focusable = catalog
      .map((c) => ({ slug: c.slug, fileId: slugToFileId.get(c.slug) }))
      .filter((c): c is { slug: string; fileId: string } => Boolean(c.fileId))
    if (focusable.length > MAX_LIBRARY_FOCUS) {
      throw new Error(
        `phase-doc-relations: Katalog zu groß für den Pro-Maßnahme-Lauf ` +
        `(${focusable.length} > ${MAX_LIBRARY_FOCUS}, Filter aktiv: ${hasFilter}). ` +
        `Galerie auf eine Gruppe filtern (z. B. nach Arbeitsgruppe/Perspektive) und ` +
        `erneut „für alle berechnen" — dann läuft es je Gruppe. Für sehr große Kataloge ` +
        `ist das skalierbare Provides/Requires-Verfahren vorgesehen ` +
        `(docs/architecture/massnahmen-beziehungen-skalierung.md).`,
      )
    }
    await repo.traceAddEvent(job.jobId, {
      spanId: 'job',
      name: 'doc_relations_library_focus_passes',
      level: 'info',
      message: `Pro-Maßnahme-Lauf: ${focusable.length} fokussierte LLM-Pässe`,
      attributes: { passes: focusable.length },
    })
    for (const c of focusable) {
      await runFocusPass(c.slug, c.fileId)
    }
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
    edgesProposed,
    edgesWritten: written.inserted,
    unknownSlugs: unknownSlugs.size,
  }
}
