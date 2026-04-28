import { randomUUID } from 'crypto'
import { FileLogger } from '@/lib/debug/logger'
import { splitByPages } from '@/lib/ingestion/page-split'
import { embedDocumentWithSecretary } from '@/lib/chat/rag-embeddings'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getTopLevelValue, validateAndSanitizeFrontmatter } from '@/lib/chat/dynamic-facets'
import { upsertVectors, upsertVectorMeta, deleteVectorsByFileId, ensureFacetIndexes } from '@/lib/repositories/vector-repo'
import { getRetrieverContext } from '@/lib/chat/retriever-context'
import type { DocMeta, ChapterMetaEntry } from '@/types/doc-meta'
import type { StorageProvider } from '@/lib/storage/types'
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { buildMetadataPrefix } from '@/lib/ingestion/metadata-formatter'
import { extractFacetValues, buildVectorDocuments } from '@/lib/ingestion/vector-builder'
import { buildMetaDocument } from '@/lib/ingestion/meta-document-builder'
import { hashId } from '@/lib/utils/string-utils'
import { AzureStorageService } from '@/lib/services/azure-storage-service'
import { calculateImageHash } from '@/lib/services/azure-storage-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { getShadowTwinBinaryFragments } from '@/lib/repositories/shadow-twin-repo'
import { parseTwinRelativeImageRef } from '@/lib/storage/shadow-twin-folder-name'
import { buildDocumentSlugFallback } from '@/lib/documents/document-slug'
import { tryDecodeRelativePathFromFileId } from '@/utils/decode-storage-file-id'
import { INGEST_META_SOURCE_FILE_NAME_KEY } from '@/lib/ingestion/ingest-meta-keys'
import * as fs from 'fs/promises'

/**
 * Best-effort Trace-Emitter fuer die Telemetry-Pfade in dieser Datei.
 * Loggt Fehler explizit, statt sie in stillen catch-Bloecken zu schlucken
 * (Welle 2.3 Schritt 4, siehe chat-contracts.mdc §2).
 */
async function emitIngestTraceEvent(
  repo: ExternalJobsRepository,
  jobId: string,
  name: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  try {
    await repo.traceAddEvent(jobId, { spanId: 'ingest', name, attributes })
  } catch (err) {
    console.warn(
      `[chat/ingest] Trace-Event "${name}" konnte nicht persistiert werden:`,
      err,
    )
  }
}

/**
 * Stub-Service zum Enqueue einer Ingestion.
 * Hier später: Markdown scannen → Summaries erzeugen → Embeddings upserten.
 */
export class IngestionService {
  static async enqueueLibraryIngestion(userEmail: string, libraryId: string): Promise<{ jobId: string }> {
    const jobId = randomUUID()
    // eslint-disable-next-line no-console
    console.log('[Ingestion] Enqueued library ingestion', { userEmail, libraryId, jobId })
    // TODO: Job in DB persistieren / Worker triggern
    return { jobId }
  }

  /**
   * Minimaler Ingestion-Lauf: erzeugt für einen Testtext ein Embedding und upsertet ihn in MongoDB.
   * Dient als End-to-End-Validierung der Pipeline.
   * Verwendet jetzt Secretary Service RAG API für Embeddings.
   */
  static async runMinimalTest(userEmail: string, libraryId: string): Promise<{ index: string; id: string }> {
    const retrieverCtx = await getRetrieverContext(userEmail, libraryId)
    const { ctx, libraryKey, dimension } = retrieverCtx

    const text = `Testchunk for ${ctx.library.label} at ${new Date().toISOString()}`
    const { embedQuestionWithSecretary } = await import('@/lib/chat/rag-embeddings')
    const embedding = await embedQuestionWithSecretary(text, ctx)
    const id = `test-${randomUUID()}`
    
      await upsertVectors(libraryKey, [{
      _id: id,
      kind: 'chunk',
      libraryId,
      user: userEmail,
      fileId: 'test',
      fileName: 'test.txt',
      chunkIndex: 0,
      text,
      embedding,
      upsertedAt: new Date().toISOString(),
    }], dimension, retrieverCtx.ctx.library)
    
    return { index: libraryKey, id }
  }

  // Bild-Verarbeitungs-Funktionen wurden nach ImageProcessor ausgelagert
  // Siehe: src/lib/ingestion/image-processor.ts

  static async upsertMarkdown(
    userEmail: string,
    libraryId: string,
    fileId: string,
    fileName: string,
    markdown: string,
    meta?: Record<string, unknown>,
    jobId?: string,
    provider?: StorageProvider,
    shadowTwinFolderId?: string,
    sourceParentId?: string,
  ): Promise<{ chunksUpserted: number; docUpserted: boolean; index: string; imageErrors?: Array<{ slideIndex: number; imageUrl: string; error: string }> }> {
    const repo = new ExternalJobsRepository()
    const retrieverCtx = await getRetrieverContext(userEmail, libraryId)
    const { ctx, libraryKey, facetDefs } = retrieverCtx
    /** Azure: Library-spezifische ingestionStorage oder globale ENV */
    const libraryConfig = ctx.library.config

    // Frontmatter strikt parsen: Meta als Single Source, Body zum Chunken
    const { meta: metaFromMarkdown, body } = await (async () => {
      try {
        const fm = await import('@/lib/markdown/frontmatter')
        const parsed = typeof fm.parseFrontmatter === 'function' ? fm.parseFrontmatter(markdown) : { meta: meta || {}, body: markdown }
        return parsed
      } catch {
        return { meta: meta || {}, body: markdown }
      }
    })()
    const metaEffective: Record<string, unknown> = { ...(metaFromMarkdown || {}), ...(meta || {}) }
    // Facetten-validierung und Parsing: fehlende Felder warnen, Typen parse/prüfen
    try {
      validateAndSanitizeFrontmatter(metaEffective, facetDefs, jobId)
    } catch (err) {
      // Frontmatter-Validierung darf den Ingest nicht blockieren —
      // sie liefert nur Warnings ueber den jobId-Logger. Wir loggen
      // hier explizit (chat-contracts.mdc §2).
      console.warn('[chat/ingest] validateAndSanitizeFrontmatter fehlgeschlagen:', err)
    }
    let spans = splitByPages(body)
    if (!Array.isArray(spans) || spans.length === 0) {
      // Fallback: Gesamten Body als eine Seite behandeln
      spans = [{ page: 1, startIdx: 0, endIdx: body.length }]
    }
    // Bevorzugt deklarierte Seitenzahl aus Meta (Frontmatter)
    const declaredPagesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { pages?: unknown }).pages : undefined
    const declaredPages = typeof declaredPagesRaw === 'number' && declaredPagesRaw > 0 ? declaredPagesRaw : undefined
    const totalPages = declaredPages || spans.length
    FileLogger.info('ingestion', 'Start kapitelgeführte Ingestion', { libraryId, fileId, pages: totalPages })
    if (jobId) bufferLog(jobId, { phase: 'ingest_start', message: `Ingestion start (pages=${totalPages})` })
    // Kapitel aus Meta lesen
    const chaptersRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { chapters?: unknown }).chapters : undefined
    const chaptersInput = Array.isArray(chaptersRaw) ? chaptersRaw as Array<Record<string, unknown>> : []

    // Idempotenz: Alte Vektoren dieses Dokuments löschen
    await deleteVectorsByFileId(libraryKey, fileId)
    FileLogger.info('ingestion', 'Vorherige Vektoren gelöscht', { fileId })
    if (jobId) bufferLog(jobId, { phase: 'indextidy', message: 'Alte Vektoren entfernt' })

    // Slide-Bilder auf Azure Storage hochladen (vor docMetaJsonObj Erstellung)
    // imageErrors muss außerhalb des try-Blocks initialisiert werden, damit es immer im Scope ist
    let imageErrors: Array<{ slideIndex: number; imageUrl: string; error: string }> | undefined = undefined

    // Hilfsfunktionen sind jetzt in src/lib/utils/string-utils.ts

    // Vorab-Checks aus Frontmatter (Warnungen, aber kein Abbruch)
    try {
      const summaryRaw = meta && typeof meta === 'object' ? (meta as { summary?: unknown }).summary : undefined
      if (!(typeof summaryRaw === 'string' && summaryRaw.trim().length > 0)) {
        FileLogger.warn('ingestion', 'Frontmatter summary fehlt oder leer', { fileId })
        if (jobId) bufferLog(jobId, { phase: 'frontmatter_missing', message: 'summary fehlt' })
      }
      // Prüfe ob Session-Modus (Slides vorhanden) → dann keine Warnung für fehlende Chapters
      const slidesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { slides?: unknown }).slides : undefined
      const isSessionMode = Array.isArray(slidesRaw) && (slidesRaw as Array<unknown>).length > 0
      if (!Array.isArray(chaptersInput) || chaptersInput.length === 0) {
        if (!isSessionMode) {
          // Nur warnen wenn KEIN Session-Modus (keine Slides vorhanden)
          FileLogger.warn('ingestion', 'Frontmatter chapters fehlen oder leer', { fileId })
          if (jobId) bufferLog(jobId, { phase: 'frontmatter_missing', message: 'chapters fehlen' })
        } else {
          // Session-Modus: Chapters sind normalerweise leer → kein Warnung
          FileLogger.info('ingestion', 'Session-Modus erkannt (keine Chapters erwartet)', { fileId })
        }
      }
    } catch (err) {
      // Vorab-Checks sind reine Warnungen — Fehler hier blockieren
      // den Ingest nicht. Logging trotzdem Pflicht
      // (chat-contracts.mdc §2, no-silent-fallbacks.mdc).
      console.warn('[chat/ingest] Frontmatter-Vorab-Check fehlgeschlagen:', err)
    }

    // Kapitel-Infos für MongoDB sammeln (ohne Chunking)
    const chaptersForMongo: ChapterMetaEntry[] = []
    for (const ch of chaptersInput) {
      const title = typeof (ch as { title?: unknown }).title === 'string' ? (ch as { title: string }).title : 'Kapitel'
      const order = typeof (ch as { order?: unknown }).order === 'number' ? (ch as { order: number }).order : undefined
      const summary = typeof (ch as { summary?: unknown }).summary === 'string' ? (ch as { summary: string }).summary : ''
      const chapterId = hashId(`${fileId}|${order ?? 0}|${title}`)
      
      chaptersForMongo.push({
        index: typeof order === 'number' ? order : chaptersForMongo.length,
        id: chapterId,
        title,
        summary: summary || undefined,
        chunkCount: 0, // Wird später aus RAG-Response aktualisiert
      })
    }
    // Doc‑Meta finalisieren: counts + ingest_status + upsertedAt (ein finales Upsert)
    try {
      const chaptersCount = chaptersInput.length
      
      // Slide-Bilder auf Azure Storage hochladen (vor docMetaJsonObj Erstellung)
      // imageErrors wurde bereits außerhalb des try-Blocks initialisiert
      if (provider) {
        const slidesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { slides?: unknown }).slides : undefined
        const slidesInput = Array.isArray(slidesRaw) ? slidesRaw as Array<Record<string, unknown>> : []
        
        if (slidesInput.length > 0) {
          FileLogger.info('ingestion', 'Verarbeite Slide-Bilder für Azure Upload', { fileId, slidesCount: slidesInput.length })
          if (jobId) {
            bufferLog(jobId, { phase: 'slide_images_processing', message: `Verarbeite ${slidesInput.length} Slide-Bilder für Azure Upload` })
          }
          
          try {
            const result = await ImageProcessor.processSlideImages(
              slidesInput,
              provider,
              libraryId,
              fileId,
              jobId,
              libraryConfig
            )
            
            // Aktualisiere Slides in metaEffective
            metaEffective.slides = result.slides
            
            // WICHTIG: Aktualisiere auch __jsonClean und __sanitized, damit die Azure-URLs in docMetaJsonObj übernommen werden
            if ((metaEffective as Record<string, unknown>)['__jsonClean']) {
              ((metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>).slides = result.slides
            }
            if ((metaEffective as Record<string, unknown>)['__sanitized']) {
              ((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>).slides = result.slides
            }
            
            // Wenn Fehler aufgetreten sind, diese sammeln
            imageErrors = result.errors.length > 0 ? result.errors : undefined
            
            FileLogger.info('ingestion', 'Slide-Bilder verarbeitet', {
              fileId,
              processed: result.slides.length,
              errors: result.errors.length,
            })
            if (jobId) {
              bufferLog(jobId, {
                phase: 'slide_images_processed',
                message: `${result.slides.length} Slide-Bilder verarbeitet${result.errors.length > 0 ? `, ${result.errors.length} Fehler` : ''}`,
              })
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            FileLogger.error('ingestion', 'Fehler beim Verarbeiten der Slide-Bilder', {
              fileId,
              error: errorMessage,
            })
            
            // Wenn Container-Fehler: Fehler weiterwerfen, damit er im Frontend angezeigt wird
            if (errorMessage.includes('Container') && errorMessage.includes('existiert nicht')) {
              if (jobId) {
                bufferLog(jobId, {
                  phase: 'slide_images_container_error',
                  message: errorMessage,
                })
              }
              throw error // Fehler weiterwerfen für Frontend-Anzeige
            }
            
            // Andere Fehler: Original-Slides beibehalten, weitermachen
            FileLogger.warn('ingestion', 'Bild-Upload fehlgeschlagen, verwende Original-Pfade', { fileId })
          }
        }
      }
      
      // Mongo-Dokument vorbereiten (vollständige Metadaten)
      // WICHTIG: Verwende metaEffective als Basis (enthält ALLE Frontmatter-Felder),
      // nicht nur __jsonClean (enthält nur Facetten-Felder).
      // Merge __jsonClean für Facetten-Validierung, aber behalte alle anderen Felder aus metaEffective.
      const jsonClean = ((metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>) || {}
      // Basis: metaEffective mit allen Frontmatter-Feldern
      // Merge: Facetten-validierte Werte aus __jsonClean haben Priorität
      const docMetaJsonObj = { ...metaEffective, ...jsonClean } as Record<string, unknown>
      // Entferne interne Felder
      delete (docMetaJsonObj as Record<string, unknown>)['__jsonClean']
      delete (docMetaJsonObj as Record<string, unknown>)['__sanitized']
      
      // Reparatur-Logik für Array-Felder, die fälschlicherweise als JSON-String gespeichert wurden
      // Beispiel: tags: '["abfallvermeidung", "recycling"]' → tags: ["abfallvermeidung", "recycling"]
      const arrayFields = ['tags', 'authors', 'topics']
      for (const field of arrayFields) {
        const value = docMetaJsonObj[field]
        if (typeof value === 'string' && value.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) {
              docMetaJsonObj[field] = parsed
            }
          } catch {
            // Parsing fehlgeschlagen - behalte Original
          }
        }
      }
      
      // Verarbeite Markdown-Bilder und Cover-Bild für Bücher (nur wenn kein Session-Modus)
      // WICHTIG: Verwende shadowTwinFolderId aus Parameter (kommt von job.shadowTwinState)
      // Dies ist die zentrale Logik, die auch Template-Phase verwendet
      let coverImageUrl: string | null = null
      const isSessionMode = chaptersInput.length === 0 && Array.isArray((metaEffective as { slides?: unknown }).slides) && ((metaEffective as { slides?: unknown }).slides as Array<unknown>).length > 0
      
      if (provider && !isSessionMode && body && typeof body === 'string' && body.trim().length > 0) {
        // Lokale Referenz: In verschachtelten async-Closures bleibt `provider` sonst `| undefined` (TS)
        const storageProvider: StorageProvider = provider
        try {
          // shadowTwinFolderId kommt bereits aus job.shadowTwinState (zentrale Logik)
          if (shadowTwinFolderId) {
            FileLogger.info('ingestion', 'Verwende Shadow-Twin-Verzeichnis aus Job-State für Bild-Verarbeitung', {
              fileId,
              shadowTwinFolderId,
            })
          } else {
            FileLogger.warn('ingestion', 'Kein Shadow-Twin-Verzeichnis im Job-State verfügbar', {
              fileId,
            })
          }
          
          // PRIORITÄT 0: Prüfe ob Azure-URL bereits im Frontmatter oder in binaryFragments vorhanden ist
          // Dies verhindert Doppelverarbeitung: Wenn das Bild bereits hochgeladen wurde,
          // verwenden wir die vorhandene URL direkt ohne erneutes Laden/Hochladen
          const frontmatterCoverImageUrl = (metaEffective as { coverImageUrl?: string })?.coverImageUrl
          const frontmatterCoverThumbnailUrl = (metaEffective as { coverThumbnailUrl?: string })?.coverThumbnailUrl
          
          if (frontmatterCoverImageUrl && typeof frontmatterCoverImageUrl === 'string' && frontmatterCoverImageUrl.trim().length > 0) {
            // FALL A: coverImageUrl ist bereits eine vollständige URL (http/https)
            // Dies ist der Fall nach der Fix-Änderung in shadow-twin-service.ts
            if (frontmatterCoverImageUrl.startsWith('http://') || frontmatterCoverImageUrl.startsWith('https://')) {
              coverImageUrl = frontmatterCoverImageUrl
              docMetaJsonObj.coverImageUrl = coverImageUrl
              
              // Auch coverThumbnailUrl übernehmen wenn vorhanden und bereits URL
              if (frontmatterCoverThumbnailUrl && 
                  typeof frontmatterCoverThumbnailUrl === 'string' && 
                  (frontmatterCoverThumbnailUrl.startsWith('http://') || frontmatterCoverThumbnailUrl.startsWith('https://'))) {
                docMetaJsonObj.coverThumbnailUrl = frontmatterCoverThumbnailUrl
              }
              
              FileLogger.info('ingestion', 'Cover-Bild URL bereits vollständig im Frontmatter (direkt übernommen)', {
                fileId,
                coverImageUrl,
                coverThumbnailUrl: frontmatterCoverThumbnailUrl,
              })
              if (jobId) {
                bufferLog(jobId, {
                  phase: 'cover_image_processed',
                  message: `Cover-Bild URL bereits vollständig im Frontmatter: ${coverImageUrl}`,
                })
              }
            } else {
              // FALL B: coverImageUrl ist Dateiname oder `_Quelle.pdf/fragment.jpeg` — binaryFragments (Anker + ggf. Quell-PDF)
              try {
                const { findSourceFileMatchingTwinFolder } = await import('@/lib/storage/shadow-twin')
                const baseItem = await storageProvider.getItemById(fileId)

                async function fragmentUrlForRef(ref: string): Promise<string | null> {
                  const parsed = parseTwinRelativeImageRef(ref)
                  const leaf = parsed?.imageFileName ?? ref
                  const sourceIds: string[] = [fileId]
                  if (parsed && baseItem) {
                    const src = await findSourceFileMatchingTwinFolder(
                      baseItem.parentId,
                      parsed.twinFolderName,
                      storageProvider,
                    )
                    if (src && !sourceIds.includes(src.id)) sourceIds.push(src.id)
                  }
                  for (const sid of sourceIds) {
                    const frags = await getShadowTwinBinaryFragments(libraryId, sid)
                    const hit = frags?.find(f => f.name === leaf && f.url)
                    if (hit?.url) return hit.url
                  }
                  return null
                }

                const coverFromFrag = await fragmentUrlForRef(frontmatterCoverImageUrl)
                if (coverFromFrag) {
                  coverImageUrl = coverFromFrag
                  docMetaJsonObj.coverImageUrl = coverImageUrl

                  if (frontmatterCoverThumbnailUrl &&
                      typeof frontmatterCoverThumbnailUrl === 'string' &&
                      !frontmatterCoverThumbnailUrl.startsWith('http://') &&
                      !frontmatterCoverThumbnailUrl.startsWith('https://')) {
                    const thumbUrl = await fragmentUrlForRef(frontmatterCoverThumbnailUrl)
                    if (thumbUrl) {
                      docMetaJsonObj.coverThumbnailUrl = thumbUrl
                    }
                  }

                  FileLogger.info('ingestion', 'Cover-Bild URL aus binaryFragments übernommen (keine Doppelverarbeitung)', {
                    fileId,
                    coverImageUrl,
                    frontmatterCoverImageUrl,
                    coverThumbnailUrl: docMetaJsonObj.coverThumbnailUrl,
                  })
                  if (jobId) {
                    bufferLog(jobId, {
                      phase: 'cover_image_processed',
                      message: `Cover-Bild aus MongoDB binaryFragments übernommen: ${coverImageUrl}`,
                    })
                  }
                }
              } catch (error) {
                FileLogger.warn('ingestion', 'Fehler beim Prüfen der binaryFragments', {
                  fileId,
                  frontmatterCoverImageUrl,
                  error: error instanceof Error ? error.message : String(error),
                })
                // Fallback auf normale Verarbeitung
              }
            }
          }
          
          // PRIORITÄT 1: Prüfe ob coverImageUrl explizit im Frontmatter gesetzt ist
          // Nur ausführen, wenn noch keine URL aus binaryFragments gefunden wurde
          if (!coverImageUrl && frontmatterCoverImageUrl && typeof frontmatterCoverImageUrl === 'string' && frontmatterCoverImageUrl.trim().length > 0) {
            FileLogger.info('ingestion', 'Verwende coverImageUrl aus Frontmatter (Fallback auf Dateisystem)', {
              fileId,
              coverImageUrl: frontmatterCoverImageUrl,
            })
            
            // Lade das explizit gesetzte Cover-Bild aus dem Shadow-Twin-Verzeichnis
            try {
              const baseItem = await storageProvider.getItemById(fileId)
              if (baseItem) {
                const { findShadowTwinImageFromAnchorContext } = await import('@/lib/storage/shadow-twin')
                const imageItem = await findShadowTwinImageFromAnchorContext(
                  baseItem,
                  frontmatterCoverImageUrl,
                  storageProvider,
                  shadowTwinFolderId,
                )
                
                if (imageItem) {
                  // Verarbeite das explizit gesetzte Cover-Bild (lade auf Azure hoch)
                  coverImageUrl = await ImageProcessor.processCoverImage(
                    storageProvider,
                    shadowTwinFolderId,
                    libraryId,
                    fileId,
                    jobId,
                    isSessionMode,
                    frontmatterCoverImageUrl, // Expliziter Dateiname
                    libraryConfig
                  )
                  
                  if (coverImageUrl) {
                    docMetaJsonObj.coverImageUrl = coverImageUrl
                    FileLogger.info('ingestion', 'Cover-Bild aus Frontmatter verarbeitet', { fileId, coverImageUrl, frontmatterCoverImageUrl, isSessionMode })
                    if (jobId) {
                      bufferLog(jobId, {
                        phase: 'cover_image_processed',
                        message: `Cover-Bild aus Frontmatter erfolgreich verarbeitet: ${coverImageUrl}`,
                      })
                    }
                  } else {
                    FileLogger.warn('ingestion', 'Cover-Bild aus Frontmatter konnte nicht verarbeitet werden', {
                      fileId,
                      frontmatterCoverImageUrl,
                    })
                  }
                } else {
                  FileLogger.warn('ingestion', 'Cover-Bild aus Frontmatter nicht gefunden', {
                    fileId,
                    frontmatterCoverImageUrl,
                    shadowTwinFolderId,
                  })
                }
              }
            } catch (error) {
              FileLogger.warn('ingestion', 'Fehler beim Verarbeiten des Cover-Bildes aus Frontmatter', {
                fileId,
                frontmatterCoverImageUrl,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
          
          // PRIORITÄT 2: Fallback auf automatische Cover-Bild-Erkennung (nur wenn kein explizites coverImageUrl vorhanden)
          if (!coverImageUrl) {
            coverImageUrl = await ImageProcessor.processCoverImage(
              storageProvider,
              shadowTwinFolderId,
              libraryId,
              fileId,
              jobId,
              isSessionMode,
              undefined,
              libraryConfig
            )
            if (coverImageUrl) {
              docMetaJsonObj.coverImageUrl = coverImageUrl
              FileLogger.info('ingestion', 'Cover-Bild automatisch erkannt', { fileId, coverImageUrl, isSessionMode })
              if (jobId) {
                bufferLog(jobId, {
                  phase: 'cover_image_processed',
                  message: `Cover-Bild automatisch erkannt: ${coverImageUrl}`,
                })
              }
            }
          }
          
          // Medien-Felder: Dateiname, `_Quelle.pdf/fragment.jpeg` oder URL — Auflösung über Anker- + Quell-Shadow-Twin-Fragmente
          try {
            const baseItemMedia = await storageProvider.getItemById(fileId)
            const resolveOneMediaRef = async (ref: string): Promise<string> => {
              if (!ref || ref.trim().length === 0) return ref
              if (ref.startsWith('http://') || ref.startsWith('https://')) return ref
              const parsed = parseTwinRelativeImageRef(ref)
              const ids: string[] = [fileId]
              if (parsed && baseItemMedia) {
                const { findSourceFileMatchingTwinFolder } = await import('@/lib/storage/shadow-twin')
                const src = await findSourceFileMatchingTwinFolder(
                  baseItemMedia.parentId,
                  parsed.twinFolderName,
                  storageProvider,
                )
                if (src && !ids.includes(src.id)) ids.push(src.id)
              }
              const leaf = parsed?.imageFileName ?? ref
              for (const sid of ids) {
                const frags = await getShadowTwinBinaryFragments(libraryId, sid)
                const hit = frags?.find(f => f.name === leaf && f.url)
                if (hit?.url) {
                  FileLogger.info('ingestion', '[STUFE-1] binaryFragment-Treffer', {
                    fileId, ref, leaf, resolvedUrl: hit.url.slice(0, 120), sourceId: sid,
                  })
                  return hit.url
                }
              }
              FileLogger.info('ingestion', '[STUFE-1] Kein binaryFragment gefunden — Dateiname bleibt', {
                fileId, ref, leaf, searchedSourceIds: ids,
              })
              return ref
            }

            const mediaFields = [
              'coverImageUrl',
              'coverThumbnailUrl',
              'speakers_image_url',
              'authors_image_url',
              'attachments_url',
              'author_image_url',
              'galleryImageUrls',
            ] as const

            for (const fieldKey of mediaFields) {
              const rawValue = docMetaJsonObj[fieldKey]
              if (rawValue == null) continue
              const before = JSON.stringify(rawValue).slice(0, 200)
              if (Array.isArray(rawValue)) {
                docMetaJsonObj[fieldKey] = await Promise.all(
                  rawValue.map(async (v) => (typeof v === 'string' ? resolveOneMediaRef(v) : v)),
                )
              } else if (typeof rawValue === 'string') {
                docMetaJsonObj[fieldKey] = await resolveOneMediaRef(rawValue)
              }
              const after = JSON.stringify(docMetaJsonObj[fieldKey]).slice(0, 200)
              FileLogger.info('ingestion', '[STUFE-1] Medien-Feld nach binaryFragments-Auflösung', {
                fileId, field: fieldKey, before, after, changed: before !== after,
              })
            }

            /**
             * Frontmatter hat oft nur coverImageUrl als https (nach Azure-Upload), aber kein coverThumbnailUrl.
             * Dann bleibt docMetaJson ohne Thumbnail → Galerie lädt das Vollbild. Thumbnail liegt aber als
             * binaryFragment (variant thumbnail / thumb_*) im Shadow-Twin — hier nachträglich verknüpfen.
             */
            const coverUrlOnly = docMetaJsonObj.coverImageUrl
            if (
              typeof coverUrlOnly === 'string' &&
              (coverUrlOnly.startsWith('http://') || coverUrlOnly.startsWith('https://')) &&
              !docMetaJsonObj.coverThumbnailUrl
            ) {
              const frags = await getShadowTwinBinaryFragments(libraryId, fileId)
              if (frags && frags.length > 0) {
                const originals = frags.filter(
                  (f) =>
                    f.kind === 'image' &&
                    f.url &&
                    f.variant !== 'thumbnail' &&
                    !f.name?.startsWith('thumb_'),
                )
                const original =
                  originals.find((f) => f.url === coverUrlOnly) ?? originals[0]
                let thumb =
                  original?.hash
                    ? frags.find(
                        (f) =>
                          f.kind === 'image' &&
                          f.url &&
                          (f.variant === 'thumbnail' || !!f.name?.startsWith('thumb_')) &&
                          f.sourceHash === original.hash,
                      )
                    : undefined
                if (!thumb) {
                  thumb = frags.find(
                    (f) =>
                      f.kind === 'image' &&
                      f.url &&
                      (f.variant === 'thumbnail' || !!f.name?.startsWith('thumb_')),
                  )
                }
                if (thumb?.url) {
                  docMetaJsonObj.coverThumbnailUrl = thumb.url
                  FileLogger.info(
                    'ingestion',
                    'coverThumbnailUrl aus binaryFragments ergänzt (Cover war nur Blob-URL ohne Frontmatter-Feld)',
                    { fileId, thumbnailName: thumb.name },
                  )
                }
              }
            }

            FileLogger.info('ingestion', 'Medien-Felder (inkl. Twin-Pfade) aus binaryFragments aufgelöst', { fileId })
          } catch (error) {
            FileLogger.warn('ingestion', 'Fehler beim Auflösen der Medien-Felder', {
              fileId, error: error instanceof Error ? error.message : String(error),
            })
          }

          // Zweiter Pass für Publish: verbleibende Dateinamen auf Blob-URLs heben
          // (wichtig für public views ohne Storage-Provider/Session).
          try {
            if (storageProvider) {
              const azureConfig = resolveAzureStorageConfig(libraryConfig)
              const azureStorage = new AzureStorageService(libraryConfig)
              const scope: 'books' | 'sessions' = isSessionMode ? 'sessions' : 'books'
              const mediaFieldsToPromote = [
                'coverImageUrl',
                'coverThumbnailUrl',
                'speakers_image_url',
                'authors_image_url',
                'attachments_url',
                'galleryImageUrls',
              ] as const

              FileLogger.info('ingestion', '[STUFE-2] Start Blob-Promote', {
                fileId, azureConfigured: !!azureConfig, azureServiceReady: azureStorage.isConfigured(), scope,
                sourceParentId: sourceParentId || '(nicht übergeben)',
              })

              const sourceItem = await storageProvider.getItemById(fileId).catch(() => null)
              const candidateFolderIds: string[] = []
              if (shadowTwinFolderId) candidateFolderIds.push(shadowTwinFolderId)
              if (sourceItem?.parentId && !candidateFolderIds.includes(sourceItem.parentId)) {
                candidateFolderIds.push(sourceItem.parentId)
              }
              // Expliziter Parent-Ordner aus Job-Kontext: stellt sicher, dass
              // Sibling-Dateien (Bilder im selben Verzeichnis) auch dann gefunden werden,
              // wenn getItemById(fileId) fehlschlägt (z.B. bei Nextcloud-Encoding-Problemen).
              if (sourceParentId && !candidateFolderIds.includes(sourceParentId)) {
                candidateFolderIds.push(sourceParentId)
              }

              FileLogger.info('ingestion', '[STUFE-2] Kandidaten-Ordner für Dateisuche', {
                fileId, candidateFolderIds,
                sourceItemParentId: sourceItem?.parentId || '(getItemById fehlgeschlagen)',
                sourceParentIdFromJob: sourceParentId || '(nicht übergeben)',
                shadowTwinFolderId,
              })

              const findItemByName = async (name: string): Promise<string | undefined> => {
                for (const folderId of candidateFolderIds) {
                  try {
                    const siblings = await storageProvider.listItemsById(folderId)
                    const match = siblings.find((it) =>
                      it.type === 'file' && it.metadata?.name?.toLowerCase() === name.toLowerCase()
                    )
                    if (match?.id) {
                      FileLogger.info('ingestion', '[STUFE-2] Datei gefunden via listItemsById', {
                        fileId, name, folderId, matchedId: match.id.slice(0, 80),
                      })
                      return match.id
                    }
                  } catch {
                    FileLogger.warn('ingestion', '[STUFE-2] listItemsById fehlgeschlagen', { fileId, name, folderId })
                  }
                }
                FileLogger.warn('ingestion', '[STUFE-2] Datei NICHT gefunden in Kandidaten-Ordnern', {
                  fileId, name, candidateFolderIds,
                })
                return undefined
              }

              const promoteToBlobUrl = async (nameOrUrl: string): Promise<string> => {
                const value = nameOrUrl.trim()
                if (!value) return value
                if (value.startsWith('http://') || value.startsWith('https://')) {
                  FileLogger.info('ingestion', '[STUFE-2] Bereits URL — übersprungen', { fileId, url: value.slice(0, 120) })
                  return value
                }
                if (!azureConfig || !azureStorage.isConfigured()) {
                  FileLogger.warn('ingestion', '[STUFE-2] Azure nicht konfiguriert — Dateiname bleibt', { fileId, value })
                  return value
                }

                // Bild aus `_Quelle.pdf/fragment.jpeg` (Storage-Twin), wenn kein Mongo-URL-Schritt greifen konnte
                if (parseTwinRelativeImageRef(value) && sourceItem) {
                  try {
                    const { findShadowTwinImageFromAnchorContext } = await import('@/lib/storage/shadow-twin')
                    const imageItem = await findShadowTwinImageFromAnchorContext(
                      sourceItem,
                      value,
                      storageProvider,
                      shadowTwinFolderId,
                    )
                    if (imageItem) {
                      const fileBinary = await storageProvider.getBinary(imageItem.id)
                      const fileBuffer = Buffer.from(await fileBinary.blob.arrayBuffer())
                      const leaf = value.split('/').pop() || value
                      const ext = leaf.split('.').pop()?.toLowerCase() || 'jpg'
                      const hash = calculateImageHash(fileBuffer)
                      const azureUrl = await azureStorage.uploadImageToScope(
                        azureConfig.containerName,
                        libraryId,
                        scope,
                        fileId,
                        hash,
                        ext,
                        fileBuffer
                      )
                      FileLogger.info('ingestion', '[STUFE-2] Twin-Pfad → Azure Upload OK', {
                        fileId, value, azureUrl: azureUrl.slice(0, 120), size: fileBuffer.length,
                      })
                      return azureUrl
                    }
                  } catch (e) {
                    FileLogger.warn('ingestion', '[STUFE-2] Twin-Pfad Blob-Promote fehlgeschlagen', {
                      fileId, value, error: e instanceof Error ? e.message : String(e),
                    })
                  }
                }

                const matchedFileId = await findItemByName(value)
                if (!matchedFileId) {
                  FileLogger.warn('ingestion', '[STUFE-2] Datei nicht im Storage gefunden — Dateiname bleibt', { fileId, value })
                  return value
                }

                const fileBinary = await storageProvider.getBinary(matchedFileId)
                const fileBuffer = Buffer.from(await fileBinary.blob.arrayBuffer())
                const ext = value.split('/').pop()?.split('.').pop()?.toLowerCase() || ''
                const isPdf = ext === 'pdf'
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)

                if (isPdf) {
                  const pdfUrl = await azureStorage.uploadPdfToScope(
                    azureConfig.containerName,
                    libraryId,
                    scope,
                    fileId,
                    value,
                    fileBuffer
                  )
                  FileLogger.info('ingestion', '[STUFE-2] PDF → Azure Upload OK', {
                    fileId, value, azureUrl: pdfUrl.slice(0, 120), size: fileBuffer.length,
                  })
                  return pdfUrl
                }

                if (isImage) {
                  const hash = calculateImageHash(fileBuffer)
                  const imgUrl = await azureStorage.uploadImageToScope(
                    azureConfig.containerName,
                    libraryId,
                    scope,
                    fileId,
                    hash,
                    ext || 'jpg',
                    fileBuffer
                  )
                  FileLogger.info('ingestion', '[STUFE-2] Bild → Azure Upload OK', {
                    fileId, value, azureUrl: imgUrl.slice(0, 120), ext, hash, size: fileBuffer.length,
                  })
                  return imgUrl
                }

                FileLogger.warn('ingestion', '[STUFE-2] Datei ist weder Bild noch PDF — übersprungen', {
                  fileId, value, ext,
                })
                return value
              }

              for (const fieldKey of mediaFieldsToPromote) {
                const raw = docMetaJsonObj[fieldKey]
                if (!raw) continue
                const before = JSON.stringify(raw).slice(0, 200)
                if (Array.isArray(raw)) {
                  const promoted = await Promise.all(
                    raw.map(async (entry) =>
                      typeof entry === 'string' ? promoteToBlobUrl(entry) : entry
                    )
                  )
                  docMetaJsonObj[fieldKey] = promoted
                } else if (typeof raw === 'string') {
                  docMetaJsonObj[fieldKey] = await promoteToBlobUrl(raw)
                }
                const after = JSON.stringify(docMetaJsonObj[fieldKey]).slice(0, 200)
                FileLogger.info('ingestion', '[STUFE-2] Medien-Feld nach Blob-Promote', {
                  fileId, field: fieldKey, before, after, changed: before !== after,
                })
              }
            }
          } catch (error) {
            FileLogger.warn('ingestion', 'Fehler beim Blob-Publish von Medien-Feldern', {
              fileId,
              error: error instanceof Error ? error.message : String(error),
            })
          }

          // Verarbeite Markdown-Bilder
          const markdownResult = await ImageProcessor.processMarkdownImages(
            body,
            storageProvider,
            libraryId,
            fileId,
            shadowTwinFolderId,
            jobId,
            isSessionMode,
            libraryConfig
          )
          
          // Verwende aktualisiertes Markdown (mit Azure-URLs)
          docMetaJsonObj.markdown = markdownResult.markdown.trim()
          
          if (markdownResult.imageErrors.length > 0) {
            FileLogger.warn('ingestion', 'Fehler beim Verarbeiten einiger Markdown-Bilder', {
              fileId,
              errorCount: markdownResult.imageErrors.length,
            })
            if (jobId) {
              bufferLog(jobId, {
                phase: 'markdown_images_errors',
                message: `${markdownResult.imageErrors.length} Fehler beim Verarbeiten der Markdown-Bilder`,
              })
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          FileLogger.warn('ingestion', 'Fehler beim Verarbeiten der Markdown-Bilder/Cover', {
            fileId,
            error: errorMessage,
          })
          // Bei Fehlern: Original-Markdown verwenden
          if (body && typeof body === 'string' && body.trim().length > 0) {
            docMetaJsonObj.markdown = body.trim()
          }
        }
      } else {
        // Kein Provider oder Session-Modus: Markdown unverändert verwenden
        if (body && typeof body === 'string' && body.trim().length > 0) {
          docMetaJsonObj.markdown = body.trim()
        }
      }
      // Zusammenfassung: finaler Stand aller Medien-Felder nach Stufe 1 + 2 + Markdown-Bilder
      {
        const summaryFields = ['coverImageUrl', 'coverThumbnailUrl', 'galleryImageUrls', 'speakers_image_url', 'authors_image_url', 'attachments_url'] as const
        const summary: Record<string, { value: string; isUrl: boolean }> = {}
        for (const fk of summaryFields) {
          const v = docMetaJsonObj[fk]
          if (v == null) continue
          if (Array.isArray(v)) {
            (v as unknown[]).forEach((entry, i) => {
              const s = typeof entry === 'string' ? entry : JSON.stringify(entry)
              summary[`${fk}[${i}]`] = { value: s.slice(0, 140), isUrl: s.startsWith('http') }
            })
          } else if (typeof v === 'string') {
            summary[fk] = { value: v.slice(0, 140), isUrl: v.startsWith('http') }
          }
        }
        const allResolved = Object.values(summary).every(e => e.isUrl)
        const unresolvedCount = Object.values(summary).filter(e => !e.isUrl).length
        FileLogger.info('ingestion', '[MEDIEN-SUMMARY] Finaler Stand aller Medien-Felder vor Upsert', {
          fileId, allResolved, unresolvedCount, totalFields: Object.keys(summary).length, summary,
        })
        if (unresolvedCount > 0) {
          FileLogger.warn('ingestion', '[MEDIEN-SUMMARY] Nicht alle Medien-Felder enthalten Azure-URLs!', {
            fileId,
            unresolvedFields: Object.entries(summary).filter(([, e]) => !e.isUrl).map(([k, e]) => `${k}=${e.value}`),
          })
        }

        // Trace-Event in MongoDB speichern, damit es im Job-Dokument sichtbar ist
        if (jobId) {
          try {
            const fieldEntries = Object.entries(summary).map(([k, e]) => `${k}: ${e.isUrl ? '✓ URL' : '✗ ' + e.value.slice(0, 60)}`)
            await repo.traceAddEvent(jobId, {
              spanId: 'ingest',
              name: 'media_fields_resolved',
              level: allResolved ? 'info' : 'warn',
              attributes: {
                allResolved,
                unresolvedCount,
                totalFields: Object.keys(summary).length,
                fields: fieldEntries,
              },
            })
          } catch { /* Trace-Fehler ignorieren */ }
        }
      }

      // WICHTIG: Stelle sicher, dass die aktualisierten Slides (mit Azure-URLs) in docMetaJsonObj sind
      if (metaEffective.slides && Array.isArray(metaEffective.slides)) {
        docMetaJsonObj.slides = metaEffective.slides
      }
      
      // PDF-Upload: Wenn docMetaJson.url fehlt, lade Original-PDF hoch
      if (provider && !docMetaJsonObj.url) {
        try {
          // Bestimme Scope basierend auf Dokumenttyp
          const scope: 'books' | 'sessions' = isSessionMode ? 'sessions' : 'books'
          
          // Lade Original-PDF vom Storage Provider
          // fileId sollte das Original-PDF sein (aus job.correlation.source.itemId)
          const pdfItem = await provider.getItemById(fileId)
          if (pdfItem && pdfItem.type === 'file') {
            const pdfMimeType = pdfItem.metadata?.mimeType || ''
            // Nur PDFs hochladen
            if (pdfMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
              FileLogger.info('ingestion', 'Lade Original-PDF für Azure-Upload', {
                fileId,
                fileName: pdfItem.metadata?.name || fileName,
              })
              if (jobId) {
                bufferLog(jobId, {
                  phase: 'pdf_upload_start',
                  message: `Lade Original-PDF hoch: ${pdfItem.metadata?.name || fileName}`,
                })
              }
              
              // Bestimme Original-Dateiname (aus PDF-Item oder fileName)
              const originalPdfFileName = pdfItem.metadata?.name || fileName
              
              // Stelle sicher, dass Dateiname .pdf Endung hat
              const sanitizedPdfFileName = originalPdfFileName.toLowerCase().endsWith('.pdf')
                ? originalPdfFileName
                : `${originalPdfFileName.replace(/\.[^/.]+$/, '')}.pdf`
              
              // Azure Storage Service für PDF-Upload
              const azureConfig = resolveAzureStorageConfig(libraryConfig)
              if (azureConfig) {
                const azureStorageInstance = new AzureStorageService(libraryConfig)
                
                if (azureStorageInstance.isConfigured()) {
                  // Prüfe ob Container existiert
                  const containerExists = await azureStorageInstance.containerExists(azureConfig.containerName)
                  if (containerExists) {
                    // Prüfe ob PDF bereits existiert (Deduplizierung)
                    const pdfExists = await azureStorageInstance.pdfExistsWithScope(
                      azureConfig.containerName,
                      libraryId,
                      scope,
                      fileId,
                      sanitizedPdfFileName
                    )
                    
                    let pdfUrl: string
                    if (pdfExists) {
                      // PDF bereits vorhanden - verwende vorhandene URL
                      pdfUrl = azureStorageInstance.getPdfUrlWithScope(
                        azureConfig.containerName,
                        libraryId,
                        scope,
                        fileId,
                        sanitizedPdfFileName
                      )
                      FileLogger.info('ingestion', 'PDF bereits vorhanden, verwende vorhandene URL', {
                        fileId,
                        pdfUrl,
                      })
                      if (jobId) {
                        bufferLog(jobId, {
                          phase: 'pdf_upload_deduplicated',
                          message: `PDF bereits vorhanden: ${sanitizedPdfFileName}`,
                        })
                      }
                    } else {
                      // Versuche Streaming-Upload, wenn möglich (direkt vom Dateisystem)
                      // Prüfe, ob Provider einen direkten Dateipfad liefern kann
                      let useStreaming = false
                      let filePath: string | undefined = undefined
                      
                      try {
                        // Prüfe, ob Provider getPathById unterstützt
                        // getPathById gibt einen relativen Pfad zurück - wir müssen den Library-Path kennen
                        if ('getPathById' in provider && typeof provider.getPathById === 'function') {
                          const relativePath = await provider.getPathById(fileId)
                          
                          if (typeof relativePath === 'string' && relativePath !== '/') {
                            // Hole Library-Path aus Library-Service
                            try {
                              const { LibraryService } = await import('@/lib/services/library-service')
                              const libService = LibraryService.getInstance()
                              const library = await libService.getLibrary(userEmail, libraryId)
                              
                              if (library && library.path) {
                                // Konstruiere absoluten Pfad: library.path + relativePath
                                const pathLib = await import('path')
                                // Entferne führenden Slash vom relativen Pfad, falls vorhanden
                                const cleanRelativePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
                                const absolutePath = pathLib.join(library.path, cleanRelativePath)
                                
                                // Prüfe, ob Datei existiert
                                try {
                                  const stats = await fs.stat(absolutePath)
                                  if (stats.isFile()) {
                                    filePath = absolutePath
                                    useStreaming = true
                                    FileLogger.info('ingestion', 'Streaming-Upload möglich - verwende direkten Dateipfad', {
                                      fileId,
                                      filePath,
                                      relativePath,
                                      libraryPath: library.path,
                                      fileSize: stats.size,
                                    })
                                  }
                                } catch {
                                  // Datei nicht gefunden oder kein Zugriff - Fallback auf Buffer
                                  FileLogger.debug('ingestion', 'Datei nicht gefunden oder kein Zugriff, verwende Buffer-Fallback', {
                                    fileId,
                                    absolutePath,
                                  })
                                }
                              }
                            } catch (libError) {
                              // Library-Service Fehler - Fallback auf Buffer
                              FileLogger.debug('ingestion', 'Library-Path konnte nicht ermittelt werden, verwende Buffer-Fallback', {
                                fileId,
                                error: libError instanceof Error ? libError.message : String(libError),
                              })
                            }
                          }
                        }
                      } catch {
                        // getPathById nicht verfügbar oder Fehler - Fallback auf Buffer
                      }
                      
                      if (useStreaming && filePath) {
                        // Streaming-Upload direkt vom Dateisystem
                        pdfUrl = await azureStorageInstance.uploadPdfToScopeFromFile(
                          azureConfig.containerName,
                          libraryId,
                          scope,
                          fileId,
                          sanitizedPdfFileName,
                          filePath
                        )
                        FileLogger.info('ingestion', 'PDF erfolgreich auf Azure hochgeladen (via Stream)', {
                          fileId,
                          pdfUrl,
                          fileName: sanitizedPdfFileName,
                          filePath,
                        })
                      } else {
                        // Fallback: Buffer-basierter Upload (für OneDrive oder wenn Streaming nicht möglich)
                        FileLogger.info('ingestion', 'Verwende Buffer-basierten Upload (Streaming nicht möglich)', {
                          fileId,
                          fileName: sanitizedPdfFileName,
                        })
                        const pdfBinary = await provider.getBinary(fileId)
                        const pdfBuffer = Buffer.from(await pdfBinary.blob.arrayBuffer())
                        
                        pdfUrl = await azureStorageInstance.uploadPdfToScope(
                          azureConfig.containerName,
                          libraryId,
                          scope,
                          fileId,
                          sanitizedPdfFileName,
                          pdfBuffer
                        )
                        FileLogger.info('ingestion', 'PDF erfolgreich auf Azure hochgeladen', {
                          fileId,
                          pdfUrl,
                          fileName: sanitizedPdfFileName,
                        })
                        if (jobId) {
                          bufferLog(jobId, {
                            phase: 'pdf_upload_completed',
                            message: `PDF hochgeladen: ${sanitizedPdfFileName}`,
                          })
                          await emitIngestTraceEvent(repo, jobId, 'pdf_uploaded', {
                            fileId,
                            fileName: sanitizedPdfFileName,
                            pdfUrl,
                            scope,
                          })
                        }
                      }
                    }
                    
                    // Setze URL in docMetaJsonObj
                    docMetaJsonObj.url = pdfUrl
                    FileLogger.info('ingestion', 'PDF-URL in docMetaJson gesetzt', {
                      fileId,
                      url: pdfUrl,
                    })
                  } else {
                    FileLogger.warn('ingestion', 'Azure Container existiert nicht, überspringe PDF-Upload', {
                      fileId,
                      containerName: azureConfig.containerName,
                    })
                    if (jobId) {
                      bufferLog(jobId, {
                        phase: 'pdf_upload_skipped',
                        message: `Azure Container existiert nicht: ${azureConfig.containerName}`,
                      })
                    }
                  }
                } else {
                  FileLogger.warn('ingestion', 'Azure Storage nicht konfiguriert, überspringe PDF-Upload', {
                    fileId,
                  })
                }
              } else {
                FileLogger.warn('ingestion', 'Azure Storage Config nicht verfügbar, überspringe PDF-Upload', {
                  fileId,
                })
              }
            } else {
              FileLogger.debug('ingestion', 'Item ist kein PDF, überspringe PDF-Upload', {
                fileId,
                mimeType: pdfMimeType,
                fileName: pdfItem.metadata?.name || fileName,
              })
            }
          } else {
            FileLogger.warn('ingestion', 'PDF-Item nicht gefunden oder kein File', {
              fileId,
              itemType: pdfItem?.type,
            })
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          FileLogger.warn('ingestion', 'Fehler beim PDF-Upload (nicht kritisch)', {
            fileId,
            error: errorMessage,
          })
          if (jobId) {
            bufferLog(jobId, {
              phase: 'pdf_upload_error',
              message: `PDF-Upload fehlgeschlagen: ${errorMessage}`,
            })
            await emitIngestTraceEvent(repo, jobId, 'pdf_upload_failed', {
              fileId,
              error: errorMessage,
            })
          }
          // Fehler nicht werfen - PDF-Upload ist optional
        }
      } else if (docMetaJsonObj.url) {
        FileLogger.info('ingestion', 'docMetaJson.url bereits vorhanden, überspringe PDF-Upload', {
          fileId,
          existingUrl: docMetaJsonObj.url,
        })
      }
      
      // chunksUpserted wird später nach dem Embedding gesetzt, initialisiere mit 0
      let chunksUpserted = 0
      
      if (typeof (docMetaJsonObj as { slug?: unknown }).slug !== 'string' || !(docMetaJsonObj as { slug?: string }).slug?.trim()) {
        docMetaJsonObj.slug = buildDocumentSlugFallback(
          fileName,
          (docMetaJsonObj as { source_file?: unknown }).source_file as string | undefined,
          (docMetaJsonObj as { title?: unknown }).title as string | undefined,
        )
      }

      // Herkunft nur informativ (Tooltip): Ordner + Dateiname ohne Client-Dekodierung von fileId
      {
        const hintedRaw = metaEffective[INGEST_META_SOURCE_FILE_NAME_KEY]
        const hinted =
          typeof hintedRaw === 'string' && hintedRaw.trim().length > 0 ? hintedRaw.trim() : ''
        delete (docMetaJsonObj as Record<string, unknown>)[INGEST_META_SOURCE_FILE_NAME_KEY]
        delete (metaEffective as Record<string, unknown>)[INGEST_META_SOURCE_FILE_NAME_KEY]

        const decoded = tryDecodeRelativePathFromFileId(fileId)
        let sourcePath = ''
        let sourceFileName = ''
        if (decoded) {
          const norm = decoded.replace(/\\/g, '/')
          const lastSlash = norm.lastIndexOf('/')
          sourcePath = lastSlash >= 0 ? norm.slice(0, lastSlash) : ''
          const baseFromDecode = lastSlash >= 0 ? norm.slice(lastSlash + 1) : norm
          sourceFileName = hinted || baseFromDecode
        } else {
          sourcePath = ''
          sourceFileName = hinted || fileName
        }
        ;(docMetaJsonObj as Record<string, unknown>).sourcePath = sourcePath
        ;(docMetaJsonObj as Record<string, unknown>).sourceFileName = sourceFileName
      }

      const mongoDoc: DocMeta = {
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        authors: Array.isArray((docMetaJsonObj as { authors?: unknown }).authors) ? ((docMetaJsonObj as { authors?: unknown[] }).authors as string[]) : undefined,
        year: ((): number | undefined => {
          const y = (docMetaJsonObj as { year?: unknown }).year;
          if (typeof y === 'number' && Number.isFinite(y)) return y;
          if (typeof y === 'string' && y.trim().length > 0) {
            const parsed = Number(y.trim());
            if (Number.isFinite(parsed)) return parsed;
          }
          return undefined;
        })(),
        region: typeof (docMetaJsonObj as { region?: unknown }).region === 'string' ? (docMetaJsonObj as { region: string }).region : undefined,
        docType: typeof (docMetaJsonObj as { docType?: unknown }).docType === 'string' ? (docMetaJsonObj as { docType: string }).docType : undefined,
        source: typeof (docMetaJsonObj as { source?: unknown }).source === 'string' ? (docMetaJsonObj as { source: string }).source : undefined,
        tags: Array.isArray((docMetaJsonObj as { tags?: unknown }).tags) ? ((docMetaJsonObj as { tags?: unknown[] }).tags as string[]) : undefined,
        // Zusätzliche Metadaten-Felder aus Frontmatter extrahieren
        title: typeof (docMetaJsonObj as { title?: unknown }).title === 'string' ? (docMetaJsonObj as { title: string }).title : undefined,
        shortTitle: typeof (docMetaJsonObj as { shortTitle?: unknown }).shortTitle === 'string' ? (docMetaJsonObj as { shortTitle: string }).shortTitle : undefined,
        slug: typeof (docMetaJsonObj as { slug?: unknown }).slug === 'string' ? (docMetaJsonObj as { slug: string }).slug : undefined,
        summary: typeof (docMetaJsonObj as { summary?: unknown }).summary === 'string' ? (docMetaJsonObj as { summary: string }).summary : undefined,
        teaser: typeof (docMetaJsonObj as { teaser?: unknown }).teaser === 'string' ? (docMetaJsonObj as { teaser: string }).teaser : undefined,
        topics: Array.isArray((docMetaJsonObj as { topics?: unknown }).topics) ? ((docMetaJsonObj as { topics?: unknown[] }).topics as string[]) : undefined,
        chunkCount: chunksUpserted, // Wird später aktualisiert
        chaptersCount,
        upsertedAt: new Date().toISOString(),
        docMetaJson: docMetaJsonObj,
        chapters: chaptersForMongo,
      }
      // Collection-Name aus Config holen (bereits oben definiert)
      // Index-Aufbau ist best-effort: Aufrufer erwartet, dass Indizes
      // lazy/idempotent angelegt werden. Fehler hier sollen den
      // Ingest nicht blockieren, aber sichtbar bleiben
      // (chat-contracts.mdc §2).
      try {
        await ensureFacetIndexes(libraryKey, facetDefs)
      } catch (err) {
        console.warn('[chat/ingest] ensureFacetIndexes fehlgeschlagen:', err)
      }
      // Facettenwerte dynamisch zusätzlich in mongoDoc spiegeln
      try {
        const sanitized = ((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>) || (metaEffective || {}) as Record<string, unknown>
        for (const d of facetDefs) {
          const v = getTopLevelValue(sanitized, d)
          if (v !== undefined && v !== null) {
            // Spezielle Behandlung für year: Validierung um NaN zu vermeiden
            if (d.metaKey === 'year') {
              let yearValue: number | undefined = undefined;
              if (typeof v === 'number' && Number.isFinite(v)) {
                yearValue = v;
              } else if (typeof v === 'string' && v.trim().length > 0) {
                const parsed = Number(v.trim());
                if (Number.isFinite(parsed)) {
                  yearValue = parsed;
                }
              }
              // Nur setzen wenn gültig, sonst undefined (wird nicht gesetzt)
              if (yearValue !== undefined) {
                (mongoDoc as Record<string, unknown>)[d.metaKey] = yearValue;
              }
            } else {
              (mongoDoc as Record<string, unknown>)[d.metaKey] = v
            }
          }
        }
      } catch (err) {
        // Facet-Spiegelung ist best-effort: Fehler in der Konvertierung
        // einzelner Felder darf nicht den ganzen Ingest brechen.
        console.warn('[chat/ingest] Facet-Mirroring in mongoDoc fehlgeschlagen:', err)
      }
      // WICHTIG: Das finale Markdown verwenden (mit Azure-Bild-URLs)
      // Dieses Markdown wird an Secretary Service RAG API gesendet
      const baseMarkdown = typeof docMetaJsonObj.markdown === 'string' && docMetaJsonObj.markdown.trim().length > 0
        ? docMetaJsonObj.markdown.trim()
        : (body && typeof body === 'string' && body.trim().length > 0 ? body.trim() : '')
      
      if (!baseMarkdown || baseMarkdown.length === 0) {
        FileLogger.warn('ingestion', 'Kein Markdown für Embedding verfügbar', { fileId })
        if (jobId) bufferLog(jobId, { phase: 'ingest_no_markdown', message: 'Kein Markdown für Embedding verfügbar' })
        return { chunksUpserted: 0, docUpserted: true, index: libraryKey, imageErrors: imageErrors ?? undefined }
      }
      
      // Metadaten als Text-Präfix vor das Markdown setzen, um Embedding-Qualität zu verbessern
      const metadataPrefix = buildMetadataPrefix(docMetaJsonObj)
      const finalMarkdown = metadataPrefix ? `${metadataPrefix}\n\n--- Dokument-Body beginnt hier ---\n\n${baseMarkdown}` : baseMarkdown
      
      // Secretary Service RAG Embedding aufrufen
      FileLogger.info('ingestion', 'Starte RAG Embedding über Secretary Service', { fileId, markdownLength: finalMarkdown.length, metadataPrefixLength: metadataPrefix?.length || 0 })
      if (jobId) bufferLog(jobId, { phase: 'ingest_rag_start', message: `RAG Embedding gestartet: ${finalMarkdown.length} Zeichen (${metadataPrefix?.length || 0} Zeichen Metadaten-Präfix)` })
      
      let ragResult
      try {
        ragResult = await embedDocumentWithSecretary(finalMarkdown, ctx, {
          documentId: fileId,
          meta: {
            fileName,
            libraryId,
            userEmail,
          },
        })
        FileLogger.info('ingestion', 'RAG Embedding erfolgreich', { fileId, chunks: ragResult.chunks.length, dimensions: ragResult.dimensions, model: ragResult.model })
        if (jobId) bufferLog(jobId, { phase: 'ingest_rag_done', message: `RAG Embedding abgeschlossen: ${ragResult.chunks.length} Chunks, ${ragResult.dimensions} Dimensionen` })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        FileLogger.error('ingestion', 'RAG Embedding fehlgeschlagen', { fileId, error: errorMessage })
        if (jobId) bufferLog(jobId, { phase: 'ingest_rag_failed', message: `RAG Embedding fehlgeschlagen: ${errorMessage}` })
        throw error
      }
      
      // MongoDB-Vektoren aus RAG-Chunks bauen (mit Facetten-Metadaten)
      const facetValues = extractFacetValues(mongoDoc, docMetaJsonObj, facetDefs)
      const vectors = buildVectorDocuments(ragResult, fileId, fileName, libraryId, userEmail, facetValues)
      
      // Aktualisiere chunksUpserted mit der tatsächlichen Anzahl der Vektoren
      chunksUpserted = vectors.length
      
      // Aktualisiere chaptersForMongo mit korrekter chunkCount (falls Kapitel vorhanden)
      if (chaptersForMongo.length > 0 && chunksUpserted > 0) {
        // Vereinfachte Annahme: Chunks gleichmäßig auf Kapitel verteilt
        const chunksPerChapter = Math.ceil(chunksUpserted / chaptersForMongo.length)
        for (const chapter of chaptersForMongo) {
          chapter.chunkCount = chunksPerChapter
        }
      }
      
      // Dimension aus Retriever-Context verwenden
      const dimension = retrieverCtx.dimension
      
      // MongoDB-Vektoren upserten
      if (vectors.length > 0) {
        await upsertVectors(libraryKey, vectors, dimension, retrieverCtx.ctx.library)
        FileLogger.info('ingestion', 'MongoDB-Vektoren upsertet', { fileId, chunks: chunksUpserted })
        if (jobId) bufferLog(jobId, { phase: 'ingest_vectors_upserted', message: `${chunksUpserted} Chunks in MongoDB upsertet` })
      }
      
      // Dokument-Embedding für globale Dokumentensuche erstellen
      let documentEmbedding: number[] | undefined = undefined
      try {
        const { buildDocumentTextForEmbedding } = await import('@/lib/ingestion/document-text-builder')
        const { embedQuestionWithSecretary } = await import('@/lib/chat/rag-embeddings')
        
        const documentText = buildDocumentTextForEmbedding(docMetaJsonObj, mongoDoc)
        if (documentText.trim().length > 0) {
          FileLogger.info('ingestion', 'Erstelle Dokument-Embedding für globale Suche', { fileId, textLength: documentText.length })
          if (jobId) bufferLog(jobId, { phase: 'doc_embedding_start', message: 'Erstelle Dokument-Embedding für globale Suche' })
          
          documentEmbedding = await embedQuestionWithSecretary(documentText, retrieverCtx.ctx)
          FileLogger.info('ingestion', 'Dokument-Embedding erstellt', { fileId, dimensions: documentEmbedding.length })
          if (jobId) bufferLog(jobId, { phase: 'doc_embedding_done', message: `Dokument-Embedding erstellt: ${documentEmbedding.length} Dimensionen` })
        } else {
          FileLogger.warn('ingestion', 'Kein Text für Dokument-Embedding verfügbar', { fileId })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        FileLogger.warn('ingestion', 'Fehler beim Erstellen des Dokument-Embeddings', { fileId, error: errorMessage })
        if (jobId) bufferLog(jobId, { phase: 'doc_embedding_failed', message: `Dokument-Embedding fehlgeschlagen: ${errorMessage}` })
        // Nicht werfen, da Hauptfunktionalität (Chunk-Embeddings) bereits erfüllt ist
      }
      
      // Debug: Logge docMetaJsonObj-Inhalt vor buildMetaDocument
      FileLogger.info('ingestion', 'docMetaJsonObj vor buildMetaDocument', {
        fileId,
        docMetaJsonObjKeys: Object.keys(docMetaJsonObj),
        docMetaJsonObjSample: {
          title: docMetaJsonObj.title,
          shortTitle: docMetaJsonObj.shortTitle,
          slug: docMetaJsonObj.slug,
          summary: typeof docMetaJsonObj.summary === 'string' ? docMetaJsonObj.summary.substring(0, 100) : docMetaJsonObj.summary,
          authors: docMetaJsonObj.authors,
          year: docMetaJsonObj.year,
          topics: docMetaJsonObj.topics,
        },
      })
      
      // Meta-Dokument erstellen und speichern (ersetzt doc_meta Collection)
      const metaDoc = buildMetaDocument(
        mongoDoc,
        docMetaJsonObj,
        chaptersForMongo,
        chaptersCount,
        chunksUpserted,
        facetValues,
        userEmail
      )
      
      // Debug: Logge metaDoc-Inhalt nach buildMetaDocument
      FileLogger.info('ingestion', 'metaDoc nach buildMetaDocument', {
        fileId,
        metaDocKeys: Object.keys(metaDoc),
        metaDocSample: {
          title: metaDoc.title,
          shortTitle: metaDoc.shortTitle,
          slug: metaDoc.slug,
          summary: typeof metaDoc.summary === 'string' ? metaDoc.summary.substring(0, 100) : metaDoc.summary,
          authors: metaDoc.authors,
          year: metaDoc.year,
          topics: metaDoc.topics,
          docMetaJsonKeys: Object.keys(metaDoc.docMetaJson || {}),
        },
      })
      
      // Embedding zum Meta-Dokument hinzufügen (falls erstellt)
      if (documentEmbedding) {
        (metaDoc as Record<string, unknown>).embedding = documentEmbedding
      }
      
      try {
        await upsertVectorMeta(libraryKey, metaDoc, dimension, retrieverCtx.ctx.library)
        FileLogger.info('ingestion', 'Meta-Dokument gespeichert', { fileId, chunks: chunksUpserted, hasEmbedding: !!documentEmbedding })
        if (jobId) {
          bufferLog(jobId, { phase: 'meta_doc_upserted', message: `Meta-Dokument gespeichert: chunks=${chunksUpserted}, chapters=${chaptersCount}, embedding=${documentEmbedding ? 'ja' : 'nein'}` })
          await emitIngestTraceEvent(repo, jobId, 'meta_doc_upsert_done', {
            fileId,
            chunks: chunksUpserted,
            chapters: chaptersCount,
            hasEmbedding: !!documentEmbedding,
          })
        }
      } catch (e) {
        FileLogger.warn('ingestion', 'Fehler beim Speichern des Meta-Dokuments', { fileId, error: String(e) })
        // Nicht werfen, da Hauptfunktionalität bereits erfüllt ist
      }
      
      FileLogger.info('ingestion', 'Upsert abgeschlossen', { fileId, chunks: chunksUpserted, vectors: vectors.length, imageErrors: imageErrors?.length ?? 0 })
      if (jobId) bufferLog(jobId, { phase: 'ingest_completed', message: `Upsert abgeschlossen: ${chunksUpserted} Chunks (${vectors.length} Vektoren)` })
      return { chunksUpserted, docUpserted: true, index: libraryKey, imageErrors: imageErrors ?? undefined }
    } catch (err) {
      FileLogger.warn('ingestion', 'Doc‑Meta finales Update fehlgeschlagen', { fileId, err: String(err) })
      if (jobId) {
        bufferLog(jobId, { phase: 'doc_meta_final_failed', message: 'Doc‑Meta finales Update fehlgeschlagen' })
        await emitIngestTraceEvent(repo, jobId, 'doc_meta_upsert_failed', {
          vectorFileId: fileId,
          error: String(err),
        })
      }
      // Kritisch: Fehler weiterwerfen, damit Orchestrator den Step/Job als failed markiert
      throw err instanceof Error ? err : new Error(String(err))
    }
  }
}

/**
 * Löst einen Dateinamen oder ein Array von Dateinamen gegen binaryFragments auf.
 * Wenn der Wert bereits eine vollständige URL ist, wird er direkt übernommen.
 * Bei relativem Dateinamen wird in den fragments nach einer passenden URL gesucht.
 *
 * Unterstützt: String-Felder (coverImageUrl, author_image_url)
 * und Array-Felder (speakers_image_url, authors_image_url, attachments_url).
 */
export function resolveMediaFieldFromFragments(
  fieldKey: string,
  value: string | string[] | undefined,
  fragments: Array<{ name: string; url?: string }>,
): string | string[] | undefined {
  if (!value) return value

  const resolveOne = (name: string): string => {
    if (!name || name.trim().length === 0) return name
    if (name.startsWith('http://') || name.startsWith('https://')) return name
    const frag = fragments.find(f => f.name === name && f.url)
    return frag?.url || name
  }

  if (Array.isArray(value)) {
    return value.map(v => typeof v === 'string' ? resolveOne(v) : v)
  }

  return resolveOne(value)
}