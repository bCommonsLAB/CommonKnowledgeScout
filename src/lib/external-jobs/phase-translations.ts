/**
 * @fileoverview External-Job Phase: phase-translations
 *
 * @description
 * Worker-Phase fuer die Doc-Translations Refactor: pro External Job
 * (`job_type: 'translation'`, `operation: 'translate'`) wird genau EINE
 * Ziel-Locale berechnet und atomar in `docMetaJson.translations.*.<locale>`
 * geschrieben. Status pro Locale wird in `docMetaJson.translationStatus.<locale>`
 * gefuehrt.
 *
 * Single Source of Truth fuer „welche Felder muessen uebersetzt werden?":
 * `getTranslatableFieldsForScope(viewType, scope)` aus dem ViewType-Registry.
 *
 * Diese Phase ist bewusst klein gehalten: sie laedt das Original aus Mongo,
 * delegiert die eigentliche LLM-Translation an `translateBookData` /
 * `translateSessionData` (oder einen generischen Translator) und schreibt das
 * Ergebnis zurueck. Sie ist NICHT mit der RAG-Pipeline gekoppelt.
 *
 * @module external-jobs/phase-translations
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import {
  getCollectionNameForLibrary,
  getMetaByFileId,
  setDocTranslationForLocale,
} from '@/lib/repositories/vector-repo'
import { LibraryService } from '@/lib/services/library-service'
import { getTranslatableFieldsForScope } from '@/lib/detail-view-types/registry'
import {
  translateBookData,
  translateSessionData,
} from '@/lib/chat/common/document-translation'
import { mapToBookDetail, mapToSessionDetail } from '@/lib/mappers/doc-meta-mappers'
import type { ExternalJob } from '@/types/external-job'
import type { TargetLanguage } from '@/lib/chat/constants'

/** Erwartete Optionen aus job.correlation.options (gesetzt vom Enqueue-Helper). */
interface PhaseTranslationsOptions {
  phase?: string
  sourceLocale?: string
  targetLocale?: string
  detailViewType?: string
  force?: boolean
}

/**
 * Fuehrt die Translation-Phase fuer einen einzelnen Job aus.
 *
 * Vorgehen:
 *  1. Lade Library + Original-DocMeta.
 *  2. Bestimme uebersetzbare Felder (Registry).
 *  3. Wenn nicht `force` und `translationStatus.<locale> === 'done'`, ueberspringen.
 *  4. Rufe LLM-Translation (BookDetail/SessionDetail) auf.
 *  5. Splitte das Resultat in `gallery` und `detail` gemaess Scope-Definition.
 *  6. Schreibe atomar via `setDocTranslationForLocale`.
 *
 * @returns kurzes Ergebnis-Objekt fuer Logging/Tracing.
 */
export async function runPhaseTranslations(job: ExternalJob): Promise<{
  fileId: string
  targetLocale: string
  written: { gallery: number; detail: number }
  skipped?: 'already_done'
}> {
  const repo = new ExternalJobsRepository()
  const opts = (job.correlation?.options || {}) as PhaseTranslationsOptions

  // ── 1) Source-Item & Library laden ────────────────────────────────────────
  const fileId = job.correlation?.source?.itemId
  if (!fileId) throw new Error('phase-translations: fileId (source.itemId) fehlt')
  const targetLocale = opts.targetLocale
  if (!targetLocale) throw new Error('phase-translations: targetLocale fehlt')
  const sourceLocale = opts.sourceLocale || 'de'

  const libraryService = LibraryService.getInstance()
  const library = await libraryService.getLibraryById(job.libraryId)
  if (!library) throw new Error('phase-translations: Library nicht gefunden')
  const libraryKey = getCollectionNameForLibrary(library)

  const meta = await getMetaByFileId(libraryKey, fileId)
  if (!meta) throw new Error('phase-translations: Doc-Meta nicht gefunden')
  const docMetaJson = (meta as { docMetaJson?: Record<string, unknown> }).docMetaJson || {}

  // ── 2) Detail-View-Typ + uebersetzbare Felder aus Registry ────────────────
  const viewType =
    opts.detailViewType ||
    (docMetaJson.detailViewType as string | undefined) ||
    'session'
  const galleryFields = getTranslatableFieldsForScope(viewType, 'gallery')
  const detailFields = getTranslatableFieldsForScope(viewType, 'detail')

  // ── 3) Idempotenz: bereits 'done'? ───────────────────────────────────────
  const status = (docMetaJson.translationStatus as Record<string, string> | undefined) || {}
  if (!opts.force && status[targetLocale] === 'done') {
    await repo.updateStep(job.jobId, 'phase-translations', {
      status: 'completed',
      details: { skipped: true, reason: 'already_done', targetLocale },
    })
    await repo.setStatus(job.jobId, 'completed')
    return { fileId, targetLocale, written: { gallery: 0, detail: 0 }, skipped: 'already_done' }
  }

  // ── 4) LLM-Translation (verwendet bestehende Translator-Helfer) ──────────
  await repo.updateStep(job.jobId, 'phase-translations', {
    status: 'running',
    startedAt: new Date(),
  })
  let llmGallery: Record<string, unknown> = {}
  let llmDetail: Record<string, unknown> = {}
  try {
    if (viewType === 'book') {
      const bookData = mapToBookDetail({
        exists: true,
        fileId,
        docMetaJson,
        chapters: Array.isArray(meta.chapters) ? meta.chapters : undefined,
        fileName: typeof meta.fileName === 'string' ? meta.fileName : undefined,
        chunkCount: typeof meta.chunkCount === 'number' ? meta.chunkCount : undefined,
        chaptersCount: typeof meta.chaptersCount === 'number' ? meta.chaptersCount : undefined,
        upsertedAt: typeof meta.upsertedAt === 'string' ? meta.upsertedAt : undefined,
      } as unknown as Parameters<typeof mapToBookDetail>[0])
      const translated = await translateBookData(
        bookData,
        targetLocale as TargetLanguage,
        sourceLocale,
        library.config?.publicPublishing?.apiKey,
      )
      ;({ gallery: llmGallery, detail: llmDetail } = splitByScope(
        translated as unknown as Record<string, unknown>,
        galleryFields,
        detailFields,
      ))
    } else if (viewType === 'session') {
      const sessionData = mapToSessionDetail({
        exists: true,
        fileId,
        docMetaJson,
        fileName: typeof meta.fileName === 'string' ? meta.fileName : undefined,
        chunkCount: typeof meta.chunkCount === 'number' ? meta.chunkCount : undefined,
        upsertedAt: typeof meta.upsertedAt === 'string' ? meta.upsertedAt : undefined,
      } as unknown as Parameters<typeof mapToSessionDetail>[0])
      const translated = await translateSessionData(
        sessionData,
        targetLocale as TargetLanguage,
        sourceLocale,
        library.config?.publicPublishing?.apiKey,
      )
      ;({ gallery: llmGallery, detail: llmDetail } = splitByScope(
        translated as unknown as Record<string, unknown>,
        galleryFields,
        detailFields,
      ))
    } else {
      // Fallback: kein spezialisierter Translator vorhanden → vorerst nur Status
      // setzen und Phase als 'failed' markieren, bis ein generischer Translator
      // existiert. Das verhindert stille Daten-Lücken.
      throw new Error(
        `phase-translations: kein Translator fuer detailViewType="${viewType}" implementiert`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setDocTranslationForLocale(libraryKey, fileId, targetLocale, {
      status: 'failed',
      error: msg,
    })
    await repo.updateStep(job.jobId, 'phase-translations', {
      status: 'failed',
      endedAt: new Date(),
      error: { message: msg, code: 'translation_failed' },
    })
    await repo.setStatus(job.jobId, 'failed', {
      error: { code: 'translation_failed', message: msg },
    })
    throw err
  }

  // ── 5) Atomar in Mongo schreiben ─────────────────────────────────────────
  await setDocTranslationForLocale(libraryKey, fileId, targetLocale, {
    gallery: llmGallery,
    detail: llmDetail,
    status: 'done',
  })

  await repo.updateStep(job.jobId, 'phase-translations', {
    status: 'completed',
    endedAt: new Date(),
    details: {
      targetLocale,
      galleryFieldCount: Object.keys(llmGallery).length,
      detailFieldCount: Object.keys(llmDetail).length,
    },
  })
  await repo.setStatus(job.jobId, 'completed')

  return {
    fileId,
    targetLocale,
    written: {
      gallery: Object.keys(llmGallery).length,
      detail: Object.keys(llmDetail).length,
    },
  }
}

/**
 * Splittet ein flaches Translation-Resultat (z.B. uebersetztes BookDetailData)
 * gemaess der Scope-Definition aus dem Registry in zwei Sub-Objekte.
 *
 * Felder mit Scope `'gallery'` oder `'both'` landen in `gallery`,
 * Felder mit Scope `'detail'` oder `'both'` landen in `detail`.
 *
 * Felder, die nicht in der Spec stehen, werden ignoriert (keine Daten-Drift).
 *
 * Exportiert fuer Unit-Tests; produktiv nur intern genutzt.
 */
export function splitByScope(
  translated: Record<string, unknown>,
  galleryFields: ReturnType<typeof getTranslatableFieldsForScope>,
  detailFields: ReturnType<typeof getTranslatableFieldsForScope>,
): { gallery: Record<string, unknown>; detail: Record<string, unknown> } {
  const gallery: Record<string, unknown> = {}
  const detail: Record<string, unknown> = {}

  const collect = (
    target: Record<string, unknown>,
    spec: ReturnType<typeof getTranslatableFieldsForScope>,
  ) => {
    for (const f of spec.text) {
      if (translated[f.key] !== undefined) target[f.key] = translated[f.key]
    }
    for (const f of spec.arrayOfText) {
      if (Array.isArray(translated[f.key])) target[f.key] = translated[f.key]
    }
    // topicLike-Felder werden in der Detail-Translation nicht erneut abgelegt,
    // sondern als Label-Map (wird hier noch nicht erzeugt – bleibt TODO fuer
    // einen dedizierten Topic-Label-Translator).
  }
  collect(gallery, galleryFields)
  collect(detail, detailFields)
  return { gallery, detail }
}
