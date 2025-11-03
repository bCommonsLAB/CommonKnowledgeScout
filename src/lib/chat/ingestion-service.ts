import { randomUUID } from 'crypto'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, upsertVectorsChunked, deleteByFilter } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { FileLogger } from '@/lib/debug/logger'
import { splitByPages } from '@/lib/ingestion/page-split'
import { chunkText } from '@/lib/text/chunk'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { parseFacetDefs, getTopLevelValue } from '@/lib/chat/dynamic-facets'
import { upsertDocMeta, ensureFacetIndexes, computeDocMetaCollectionName } from '@/lib/repositories/doc-meta-repo'
import type { DocMeta, ChapterMetaEntry } from '@/types/doc-meta'
import type { StorageProvider } from '@/lib/storage/types'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'

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
   * Minimaler Ingestion-Lauf: erzeugt für einen Testtext ein Embedding und upsertet ihn in Pinecone.
   * Dient als End-to-End-Validierung der Pipeline.
   */
  static async runMinimalTest(userEmail: string, libraryId: string): Promise<{ index: string; id: string }> {
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) throw new Error('Bibliothek nicht gefunden')

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')

    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) throw new Error('Index nicht gefunden oder ohne Host')

    const text = `Testchunk for ${ctx.library.label} at ${new Date().toISOString()}`
    const [embedding] = await embedTexts([text])
    const id = `test-${randomUUID()}`
    await upsertVectorsChunked(idx.host, apiKey, [{ id, values: embedding, metadata: { kind: 'test', user: userEmail, libraryId } }])
    return { index: ctx.vectorIndex, id }
  }

  /**
   * Kapitelgeführter Upsert eines Markdown-Inhalts in Pinecone:
   * - Kapiteltext via Seitenbereiche schneiden (--- Seite N ---)
   * - Zeichenbasiert chunken (1500/100)
   * - Kapitel-Metadaten je Chunk beilegen
   */
  /**
   * Verarbeitet Slide-Bilder und lädt sie auf Azure Storage hoch
   * Dedupliziert Bilder basierend auf Hash
   * @returns Object mit updatedSlides und errors Array
   */
  private static async processSlideImagesToAzure(
    slides: Array<Record<string, unknown>>,
    provider: StorageProvider,
    libraryId: string,
    fileId: string,
    jobId?: string
  ): Promise<{ slides: Array<Record<string, unknown>>; errors: Array<{ slideIndex: number; imageUrl: string; error: string }> }> {
    const azureConfig = getAzureStorageConfig()
    if (!azureConfig) {
      FileLogger.info('ingestion', 'Azure Storage nicht konfiguriert, überspringe Bild-Upload')
      return { slides, errors: [] }
    }

    const azureStorage = new AzureStorageService()
    if (!azureStorage.isConfigured()) {
      FileLogger.warn('ingestion', 'Azure Storage Service nicht konfiguriert')
      return { slides, errors: [] }
    }

    // Prüfe ob Container existiert
    const containerExists = await azureStorage.containerExists(azureConfig.containerName)
    if (!containerExists) {
      const errorMessage = `[Schritt: Azure Container Prüfung] Azure Storage Container '${azureConfig.containerName}' existiert nicht. Bitte erstellen Sie den Container im Azure Portal mit öffentlichem Blob-Zugriff.`
      FileLogger.error('ingestion', 'Azure Container existiert nicht', {
        containerName: azureConfig.containerName,
        fileId,
      })
      if (jobId) {
        bufferLog(jobId, {
          phase: 'slide_images_container_error',
          message: errorMessage,
        })
      }
      // Fehler werfen damit er im Frontend angezeigt werden kann
      throw new Error(errorMessage)
    }

    const updatedSlides: Array<Record<string, unknown>> = []
    const errors: Array<{ slideIndex: number; imageUrl: string; error: string }> = []

    for (let i = 0; i < slides.length; i++) {
      const slide = { ...slides[i] }
      const imageUrl = typeof slide.image_url === 'string' ? slide.image_url : ''

      // Prüfe ob bereits eine Azure-URL oder absolute URL
      if (!imageUrl || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        updatedSlides.push(slide)
        continue
      }

      try {
        // Konvertiere relativen Pfad zu fileId (base64-kodiert)
        const normalizedPath = imageUrl.replace(/^\/+|\/+$/g, '')
        if (normalizedPath.includes('..')) {
          const errorMsg = '[Schritt: Bild-Pfad Validierung] Path traversal erkannt'
          FileLogger.warn('ingestion', errorMsg, { imageUrl, fileId })
          errors.push({ slideIndex: i, imageUrl, error: errorMsg })
          updatedSlides.push(slide)
          continue
        }

        // UTF-8 zu Base64 (wie in resolveImageUrl)
        const utf8Bytes = Buffer.from(normalizedPath, 'utf-8')
        const fileIdForImage = utf8Bytes.toString('base64')

        // Lade Bild aus Storage
        const bin = await provider.getBinary(fileIdForImage)
        const buffer = Buffer.from(await bin.blob.arrayBuffer())

        // Berechne Hash
        const hash = calculateImageHash(buffer)

        // Bestimme Extension
        const extension = normalizedPath.split('.').pop()?.toLowerCase() || 'jpg'

        // Prüfe ob Bild bereits existiert
        const existingUrl = await azureStorage.getImageUrlByHash(
          azureConfig.containerName,
          libraryId,
          hash,
          extension
        )

        let azureUrl: string
        if (existingUrl) {
          // Verwende vorhandene URL
          azureUrl = existingUrl
          FileLogger.info('ingestion', 'Bild bereits vorhanden, verwende vorhandene URL', {
            fileId,
            hash,
            azureUrl,
          })
          if (jobId) {
            bufferLog(jobId, {
              phase: 'slide_image_deduplicated',
              message: `Bild ${i + 1}: Hash ${hash} bereits vorhanden`,
            })
          }
        } else {
          // Lade auf Azure hoch
          azureUrl = await azureStorage.uploadImage(
            azureConfig.containerName,
            libraryId,
            hash,
            extension,
            buffer
          )
          FileLogger.info('ingestion', 'Bild auf Azure hochgeladen', {
            fileId,
            hash,
            extension,
            azureUrl,
          })
          if (jobId) {
            bufferLog(jobId, {
              phase: 'slide_image_uploaded',
              message: `Bild ${i + 1}: ${hash}.${extension} hochgeladen`,
            })
          }
        }

        // Ersetze image_url mit Azure-URL
        slide.image_url = azureUrl
        updatedSlides.push(slide)
      } catch (error) {
        // Fehler beim Upload: Original-Pfad beibehalten, Fehler sammeln
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
        FileLogger.warn('ingestion', 'Fehler beim Verarbeiten des Slide-Bildes', {
          fileId,
          slideIndex: i,
          imageUrl,
          error: errorMessage,
        })
        
        // Spezielle Fehlermeldungen für verschiedene Fehlertypen
        let userFriendlyError = errorMessage
        if (errorMessage.includes('not found') || errorMessage.includes('nicht gefunden')) {
          userFriendlyError = `[Schritt: Bild-Upload] Bild nicht gefunden: ${imageUrl}`
        } else if (errorMessage.includes('does not exist')) {
          userFriendlyError = `[Schritt: Bild-Upload] Bild-Datei existiert nicht: ${imageUrl}`
        } else if (errorMessage.includes('Upload fehlgeschlagen')) {
          userFriendlyError = `[Schritt: Bild-Upload] Upload fehlgeschlagen für ${imageUrl}: ${errorMessage.replace('Upload fehlgeschlagen: ', '')}`
        } else {
          userFriendlyError = `[Schritt: Bild-Upload] ${errorMessage}`
        }
        
        errors.push({ slideIndex: i, imageUrl, error: userFriendlyError })
        updatedSlides.push(slide) // Original-Pfad beibehalten
        
        if (jobId) {
          bufferLog(jobId, {
            phase: 'slide_image_error',
            message: `Bild ${i + 1}: ${userFriendlyError}`,
          })
        }
      }
    }

    return { slides: updatedSlides, errors }
  }

  static async upsertMarkdown(
    userEmail: string,
    libraryId: string,
    fileId: string,
    fileName: string,
    markdown: string,
    meta?: Record<string, unknown>,
    jobId?: string,
    provider?: StorageProvider,
  ): Promise<{ chunksUpserted: number; docUpserted: boolean; index: string; imageErrors?: Array<{ slideIndex: number; imageUrl: string; error: string }> }> {
    const repo = new ExternalJobsRepository()
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) throw new Error('Bibliothek nicht gefunden')

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')

    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) throw new Error('Index nicht gefunden oder ohne Host')

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
      const defs = parseFacetDefs(ctx.library)
      const sanitized: Record<string, unknown> = { ...metaEffective }
      const stripWrappingQuotes = (s: string): string => {
        const t = s.trim()
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1).trim()
        return t
      }
      const toStringArray = (val: unknown): string[] | undefined => {
        if (Array.isArray(val)) return val.map(v => stripWrappingQuotes(typeof v === 'string' ? v : String(v))).filter(Boolean)
        if (typeof val === 'string') {
          const t = val.trim()
          try {
            if (t.startsWith('[') && t.endsWith(']')) {
              const arr = JSON.parse(t)
              if (Array.isArray(arr)) return arr.map(v => stripWrappingQuotes(typeof v === 'string' ? v : String(v))).filter(Boolean)
            }
          } catch {}
          // Fallback: Komma-separiert
          return t.split(',').map(s => stripWrappingQuotes(s)).filter(Boolean)
        }
        return undefined
      }
      const deepClean = (val: unknown): unknown => {
        if (val === null || val === undefined) return undefined
        if (typeof val === 'string') {
          const trimmed = val.trim()
          // JSON-Array als String → Array of strings
          if ((trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              const arr = JSON.parse(trimmed)
              if (Array.isArray(arr)) {
                // Wichtig: Elemente rekursiv bereinigen und Typen bewahren (Objekte nicht stringifizieren)
                return arr
                  .map(x => deepClean(x))
                  .filter(v => v !== undefined)
              }
            } catch {}
          }
          return stripWrappingQuotes(trimmed)
        }
        if (Array.isArray(val)) return val.map(x => deepClean(x)).filter(v => v !== undefined)
        if (typeof val === 'object') {
          const out: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            const cleaned = deepClean(v)
            if (cleaned !== undefined) out[k] = cleaned
          }
          return out
        }
        return val
      }
      for (const def of defs) {
        const raw = (metaEffective as Record<string, unknown>)[def.metaKey]
        let parsed = getTopLevelValue(metaEffective, def)
        if ((def.type === 'number' || def.type === 'integer-range') && typeof parsed === 'number') {
          if (!Number.isFinite(parsed)) parsed = undefined
        }
        if (def.type === 'string' && typeof parsed === 'string') {
          parsed = stripWrappingQuotes(parsed)
        }
        if (def.type === 'string[]') {
          const arr = toStringArray(parsed === undefined ? raw : parsed)
          parsed = Array.isArray(arr) ? arr : undefined
        }
        if (parsed === undefined) {
          if (raw === undefined) {
            if (jobId) bufferLog(jobId, { phase: 'facet_missing', message: `Meta fehlt: ${def.metaKey}` })
          } else {
            if (jobId) bufferLog(jobId, { phase: 'facet_type_mismatch', message: `Typfehler: ${def.metaKey}`, details: { expected: def.type, actual: typeof raw } as unknown as Record<string, unknown> })
          }
          // nichts setzen → Feld bleibt ggf. unverändert/entfällt später beim Sanitize
        } else {
          sanitized[def.metaKey] = parsed
        }
      }
      // null/undefined entfernen für docMetaJson
      for (const k of Object.keys(sanitized)) if (sanitized[k] === null || sanitized[k] === undefined) delete sanitized[k]
      ;(metaEffective as Record<string, unknown>)['__sanitized'] = sanitized // intern; später für docMetaJson genutzt
      // Zusätzlich: vollständige, bereinigte Kopie für docMetaJson (auch Keys außerhalb der Facetten)
      const mergedForJson: Record<string, unknown> = { ...(metaEffective as Record<string, unknown>) }
      delete mergedForJson['__sanitized']
      for (const [k, v] of Object.entries(sanitized)) mergedForJson[k] = v
      ;(metaEffective as Record<string, unknown>)['__jsonClean'] = deepClean(mergedForJson)
    } catch {}
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
    await deleteByFilter(idx.host, apiKey, { user: { $eq: userEmail }, libraryId: { $eq: libraryId }, fileId: { $eq: fileId } })
    FileLogger.info('ingestion', 'Vorherige Vektoren gelöscht', { fileId })
    if (jobId) bufferLog(jobId, { phase: 'indextidy', message: 'Alte Vektoren entfernt' })

    const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
    let globalChunkIndex = 0
    
    // Slide-Bilder auf Azure Storage hochladen (vor docMetaJsonObj Erstellung)
    // imageErrors muss außerhalb des try-Blocks initialisiert werden, damit es immer im Scope ist
    let imageErrors: Array<{ slideIndex: number; imageUrl: string; error: string }> | undefined = undefined

    // Hilfsfunktionen
    const safeText = (s: string, max: number) => s.length > max ? s.slice(0, max) : s
    const toStrArr = (val: unknown, limit = 10, maxLen = 64): string[] => {
      if (!Array.isArray(val)) return []
      return val
        .map(v => typeof v === 'string' ? v : String(v))
        .filter(Boolean)
        .slice(0, limit)
        .map(v => v.length > maxLen ? v.slice(0, maxLen) : v)
    }
    const hashId = (s: string) => {
      let h = 0
      for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
      return Math.abs(h).toString(36)
    }

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
    } catch {}

    // Coverage‑Tracking (nur für Diagnose)
    const pageCovered: boolean[] = new Array<boolean>(Math.max(1, totalPages)).fill(false)

    const chaptersForMongo: ChapterMetaEntry[] = []
    for (const ch of chaptersInput) {
      const title = typeof (ch as { title?: unknown }).title === 'string' ? (ch as { title: string }).title : 'Kapitel'
      const level = typeof (ch as { level?: unknown }).level === 'number' ? (ch as { level: number }).level : undefined
      const order = typeof (ch as { order?: unknown }).order === 'number' ? (ch as { order: number }).order : undefined
      let startPage = typeof (ch as { startPage?: unknown }).startPage === 'number' ? (ch as { startPage: number }).startPage : undefined
      let endPage = typeof (ch as { endPage?: unknown }).endPage === 'number' ? (ch as { endPage: number }).endPage : undefined
      const pageCount = typeof (ch as { pageCount?: unknown }).pageCount === 'number' ? (ch as { pageCount: number }).pageCount : undefined
      const startEvidence = typeof (ch as { startEvidence?: unknown }).startEvidence === 'string' ? (ch as { startEvidence: string }).startEvidence : ''
      const summary = typeof (ch as { summary?: unknown }).summary === 'string' ? (ch as { summary: string }).summary : ''
      const keywords = toStrArr((ch as { keywords?: unknown }).keywords)

      if (!startPage) startPage = 1
      if (!endPage) endPage = startPage
      if (startPage < 1) startPage = 1
      if (endPage < startPage) endPage = startPage
      const maxAvailablePage = declaredPages || (spans.length > 0 ? spans[spans.length - 1].page : 1)
      if (endPage > maxAvailablePage) endPage = maxAvailablePage
      const segs = spans.filter(p => p.page >= startPage! && p.page <= endPage!)
      if (segs.length === 0) {
        if (jobId) {
          const available = spans.length > 0 ? `${spans[0].page}-${spans[spans.length - 1].page}` : 'none'
          bufferLog(jobId, { phase: 'chapters_page_not_found', message: `Kapitel ${order ?? '-'}: Seitenbereich fehlt (${startPage}-${endPage})`, details: { availablePages: available } as unknown as Record<string, unknown> })
        }
      }
      if (startEvidence) {
        const pageText = segs.length > 0 ? body.slice(segs[0].startIdx, segs[0].endIdx) : ''
        const rx = (() => {
          const words = (startEvidence.split(/\s+/).filter(Boolean).slice(0, 10) || [])
            .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          return words.length === 0 ? null : new RegExp(words.join('\\W+'), 'i')
        })()
        if (rx) {
          const found = pageText.search(rx)
          if (jobId) {
            if (found >= 0) bufferLog(jobId, { phase: 'chapters_start_present', message: `Kapitel ${order ?? '-'}: Evidence auf Startseite vorhanden`, details: { page: segs[0].page } })
            else bufferLog(jobId, { phase: 'chapters_start_absent', message: `Kapitel ${order ?? '-'}: Evidence auf Startseite nicht gefunden`, details: { page: segs[0].page } })
          }
        }
      }
      const firstSlice = segs.length > 0 ? body.slice(segs[0].startIdx, segs[0].endIdx) : ''
      const rest = segs.slice(1).map(s => body.slice(s.startIdx, s.endIdx)).join('')
      const chapterText = firstSlice + rest

      const chunkTexts = chunkText(chapterText, 1500, 100)
      FileLogger.info('ingestion', 'Kapitel geschnitten', { fileId, order, title, startPage, endPage, textChars: chapterText.length, chunks: chunkTexts.length })
      if (jobId) bufferLog(jobId, { phase: 'chapters', message: `Kapitel ${order ?? '-'}: Seiten ${startPage}-${endPage}, Text=${chapterText.length} chars, Chunks=${chunkTexts.length}` })
      if (chunkTexts.length === 0) continue
      const embeds = await embedTexts(chunkTexts)
      FileLogger.info('ingestion', 'Embeddings erzeugt', { fileId, order, chunks: chunkTexts.length })

      const chapterId = hashId(`${fileId}|${order ?? 0}|${title}`)
      const upsertedAt = new Date().toISOString()
      // Für Mongo Kapitelübersicht erfassen
      chaptersForMongo.push({
        index: typeof order === 'number' ? order : chaptersForMongo.length,
        id: chapterId,
        title,
        summary: summary || undefined,
        chunkCount: chunkTexts.length,
      })

      embeds.forEach((values, localIdx) => {
        const id = `${fileId}-${globalChunkIndex}`
        const metadata: Record<string, unknown> = {
          kind: 'chunk', user: userEmail, libraryId, fileId, fileName,
          chunkIndex: globalChunkIndex, text: safeText(chunkTexts[localIdx], 1200), upsertedAt,
          chapterId, chapterOrder: order, chapterTitle: title, level,
          startPage, endPage, pageCount, summaryShort: safeText(summary, 320), keywords,
          sourceType: 'chapter', // Markierung: kommt aus Chapters
        }
        vectors.push({ id, values, metadata })
        globalChunkIndex += 1
      })

      for (let p = startPage; p <= endPage; p++) pageCovered[p - 1] = true

      if (summary) {
        const [sv] = await embedTexts([summary])
        vectors.push({
          id: `${fileId}-chap-${chapterId}`,
          values: sv,
          metadata: {
            kind: 'chapterSummary', user: userEmail, libraryId, fileId, fileName,
            chapterId, chapterTitle: title, order, startPage, endPage,
            text: safeText(summary, 1200), keywords, upsertedAt,
          } as Record<string, unknown>
        })
        FileLogger.info('ingestion', 'Kapitel-Summary vektorisiert', { fileId, order, title })
        if (jobId) bufferLog(jobId, { phase: 'chapters', message: `Kapitel ${order ?? '-'}: Summary vektorisiert` })
      }
    }

    // Session-Modus: Wenn keine Chapters vorhanden, aber Slides vorhanden → Slides als Chunks behandeln
    if (chaptersInput.length === 0) {
      const slidesRaw = metaEffective && typeof metaEffective === 'object' ? (metaEffective as { slides?: unknown }).slides : undefined
      const slidesInput = Array.isArray(slidesRaw) ? slidesRaw as Array<Record<string, unknown>> : []
      
      if (slidesInput.length > 0) {
        FileLogger.info('ingestion', 'Session-Modus erkannt: Verarbeite Slides als Chunks', { fileId, slidesCount: slidesInput.length })
        if (jobId) bufferLog(jobId, { phase: 'session_mode', message: `Session-Modus: ${slidesInput.length} Slides werden als Chunks verarbeitet` })
        
        // 1. Slides chunken: slide_text (Originaltext) verwenden, nicht summary!
        for (let slideIdx = 0; slideIdx < slidesInput.length; slideIdx++) {
          const slide = slidesInput[slideIdx]
          const slidePageNum = typeof (slide as { page_num?: unknown }).page_num === 'number' ? (slide as { page_num: number }).page_num : slideIdx + 1
          const slideTitle = typeof (slide as { title?: unknown }).title === 'string' ? (slide as { title: string }).title : `Folie ${slidePageNum}`
          const slideText = typeof (slide as { slide_text?: unknown }).slide_text === 'string' ? (slide as { slide_text: string }).slide_text : ''
          const slideSummary = typeof (slide as { summary?: unknown }).summary === 'string' ? (slide as { summary: string }).summary : ''
          
          // WICHTIG: slide_text (Originaltext) verwenden, nicht summary!
          if (slideText && slideText.trim().length > 0) {
            // Slide-Text chunken (1500/100, wie Chapters)
            const slideChunks = chunkText(slideText, 1500, 100)
            if (slideChunks.length > 0) {
              const slideEmbeds = await embedTexts(slideChunks)
              const slideId = hashId(`${fileId}|slide|${slidePageNum}`)
              const upsertedAt = new Date().toISOString()
              
              slideEmbeds.forEach((values, localIdx) => {
                const id = `${fileId}-${globalChunkIndex}`
                const metadata: Record<string, unknown> = {
                  kind: 'chunk', // Normale Chunks, damit Retriever sie findet!
                  user: userEmail, libraryId, fileId, fileName,
                  chunkIndex: globalChunkIndex,
                  text: safeText(slideChunks[localIdx], 1200), // WICHTIG: Originaltext, nicht summary!
                  upsertedAt,
                  // Slide-Metadaten für Kontext
                  slidePageNum,
                  slideTitle,
                  slideSummary: safeText(slideSummary, 320), // Nur für Kontext, nicht für Retrieval
                  slideId,
                  sourceType: 'slides', // Markierung: kommt aus Slides (slide_text)
                }
                vectors.push({ id, values, metadata })
                globalChunkIndex += 1
              })
              
              FileLogger.info('ingestion', 'Slide gechunkt', { fileId, slidePageNum, slideTitle, chunks: slideChunks.length })
              if (jobId) bufferLog(jobId, { phase: 'slide_chunked', message: `Slide ${slidePageNum}: ${slideChunks.length} Chunks aus slide_text` })
            }
          } else {
            FileLogger.warn('ingestion', 'Slide ohne slide_text übersprungen', { fileId, slidePageNum, slideTitle })
            if (jobId) bufferLog(jobId, { phase: 'slide_skipped', message: `Slide ${slidePageNum}: Kein slide_text vorhanden` })
          }
        }
        
        // 2. Body chunken (falls vorhanden und nicht leer)
        if (body && body.trim().length > 0) {
          const bodyChunks = chunkText(body, 1500, 100)
          if (bodyChunks.length > 0) {
            const bodyEmbeds = await embedTexts(bodyChunks)
            const upsertedAt = new Date().toISOString()
            
            bodyEmbeds.forEach((values, localIdx) => {
              const id = `${fileId}-${globalChunkIndex}`
              const metadata: Record<string, unknown> = {
                kind: 'chunk',
                user: userEmail, libraryId, fileId, fileName,
                chunkIndex: globalChunkIndex,
                text: safeText(bodyChunks[localIdx], 1200),
                upsertedAt,
                sourceType: 'body', // Markierung: kommt aus Body, nicht aus Slide
              }
              vectors.push({ id, values, metadata })
              globalChunkIndex += 1
            })
            
            FileLogger.info('ingestion', 'Body gechunkt', { fileId, chunks: bodyChunks.length })
            if (jobId) bufferLog(jobId, { phase: 'body_chunked', message: `Body: ${bodyChunks.length} Chunks` })
          }
        }
        
        // 3. Video-Transkript chunken (falls vorhanden)
        const videoTranscript = typeof (metaEffective as { video_transcript?: unknown }).video_transcript === 'string' 
          ? (metaEffective as { video_transcript: string }).video_transcript 
          : ''
        
        if (videoTranscript && videoTranscript.trim().length > 0) {
          const transcriptChunks = chunkText(videoTranscript, 1500, 100)
          if (transcriptChunks.length > 0) {
            const transcriptEmbeds = await embedTexts(transcriptChunks)
            const upsertedAt = new Date().toISOString()
            
            transcriptEmbeds.forEach((values, localIdx) => {
              const id = `${fileId}-${globalChunkIndex}`
              const metadata: Record<string, unknown> = {
                kind: 'chunk',
                user: userEmail, libraryId, fileId, fileName,
                chunkIndex: globalChunkIndex,
                text: safeText(transcriptChunks[localIdx], 1200),
                upsertedAt,
                sourceType: 'video_transcript', // Markierung: kommt aus Video-Transkript
              }
              vectors.push({ id, values, metadata })
              globalChunkIndex += 1
            })
            
            FileLogger.info('ingestion', 'Video-Transkript gechunkt', { fileId, chunks: transcriptChunks.length })
            if (jobId) bufferLog(jobId, { phase: 'transcript_chunked', message: `Video-Transkript: ${transcriptChunks.length} Chunks` })
          }
        }
      }
    }

    // Kompakter Fortschritt nach dem Chunking
    const chunksPlanned = vectors.filter(v => (v.metadata?.kind === 'chunk')).length
    if (jobId) bufferLog(jobId, { phase: 'ingest_chunking_done', message: `Chunking abgeschlossen: ${chunksPlanned} Chunks, ${vectors.length} Vektoren` })

    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)
    const chunksUpserted = vectors.filter(v => (v.metadata?.kind === 'chunk')).length
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
            const result = await IngestionService.processSlideImagesToAzure(
              slidesInput,
              provider,
              libraryId,
              fileId,
              jobId
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
      const docMetaJsonObj = (((metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>) || ((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>) || metaEffective || {}) as Record<string, unknown>
      // Markdown-Body als separates Feld für Detailansicht hinzufügen (nicht Summary für Retrieval)
      if (body && typeof body === 'string' && body.trim().length > 0) {
        docMetaJsonObj.markdown = body.trim()
      }
      // WICHTIG: Stelle sicher, dass die aktualisierten Slides (mit Azure-URLs) in docMetaJsonObj sind
      if (metaEffective.slides && Array.isArray(metaEffective.slides)) {
        docMetaJsonObj.slides = metaEffective.slides
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
        chunkCount: chunksUpserted,
        chaptersCount,
        upsertedAt: new Date().toISOString(),
        docMetaJson: docMetaJsonObj,
        chapters: chaptersForMongo,
      }
      // In Mongo speichern (Upsert) – dynamische Indizes je Library sicherstellen
      const defs = parseFacetDefs(ctx.library)
      const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
      const libraryKey = computeDocMetaCollectionName(userEmail, libraryId, strategy)
      try { await ensureFacetIndexes(libraryKey, defs) } catch {}
      // Facettenwerte dynamisch zusätzlich in mongoDoc spiegeln
      try {
        const sanitized = ((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>) || (metaEffective || {}) as Record<string, unknown>
        for (const d of defs) {
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
      } catch {}
      // Events für Mongo-Upsert
      if (jobId) {
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_mongo_upsert_start', attributes: { libraryKey, fileId, fileName } }) } catch {}
      }
      try {
        await upsertDocMeta(libraryKey, mongoDoc)
        if (jobId) {
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_mongo_upsert_done', attributes: { libraryKey, fileId } }) } catch {}
        }
      } catch (e) {
        if (jobId) {
          try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_mongo_upsert_failed', attributes: { libraryKey, fileId, error: String(e) } }) } catch {}
        }
        throw e
      }
      // Schlankes Pinecone Doc-Meta vorbereiten (nur minimale Felder)
      const finalMeta: Record<string, unknown> = {
        kind: 'doc', user: userEmail, libraryId, fileId, fileName,
        chunkCount: chunksUpserted, chaptersCount,
        ingest_status: 'completed',
        upsertedAt: mongoDoc.upsertedAt,
      }
      // WICHTIG: Keine Facetten-Metadaten mehr nach Pinecone spiegeln (nur Minimal-Set)
      // Values aus summary oder Fallback Einheitsvektor
      const { composeDocSummaryText } = await import('@/lib/chat/facets')
      const summaryText = composeDocSummaryText((((metaEffective as Record<string, unknown>)['__sanitized'] as Record<string, unknown>) || metaEffective || {}) as Record<string, unknown>)
      const dim = typeof (idx as unknown as { dimension?: unknown }).dimension === 'number' ? (idx as unknown as { dimension: number }).dimension : 3072
      let values: number[] = new Array<number>(dim).fill(0); values[0] = 1
      try {
        if (summaryText && summaryText.length > 0) {
          const { embedTexts } = await import('@/lib/chat/embeddings')
          const [docEmbed] = await embedTexts([summaryText])
          values = docEmbed
        }
      } catch {}
      if (jobId) {
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_upsert_start', attributes: { vectorFileId: fileId, fileName } }) } catch {}
      }
      // Pinecone erlaubt nur string | number | boolean | string[]
      // Null/Undefined entfernen, Arrays zu string[] normalisieren, Nicht-primitive entfernen
      const sanitizedMeta: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(finalMeta)) {
        if (v === null || v === undefined) continue
        if (Array.isArray(v)) {
          const arr = v.filter(x => x !== null && x !== undefined).map(x => (typeof x === 'string' ? x : String(x)))
          sanitizedMeta[k] = arr
          continue
        }
        const t = typeof v
        if (t === 'string' || t === 'number' || t === 'boolean') {
          sanitizedMeta[k] = t === 'string' ? (v as string).trim() : v
          continue
        }
      }
      await upsertVectorsChunked(idx.host, apiKey, [{ id: `${fileId}-meta`, values, metadata: sanitizedMeta }], 1)
      FileLogger.info('ingestion', 'Doc‑Meta finalisiert', { fileId, chunks: chunksUpserted, chapters: chaptersCount })
      if (jobId) {
        bufferLog(jobId, { phase: 'doc_meta_final', message: `Doc‑Meta finalisiert: chunks=${chunksUpserted}, chapters=${chaptersCount}` })
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_upsert_done', attributes: { vectorFileId: fileId, id: `${fileId}-meta`, chunks: chunksUpserted, chapters: chaptersCount } }) } catch {}
      }
    } catch (err) {
      FileLogger.warn('ingestion', 'Doc‑Meta finales Update fehlgeschlagen', { fileId, err: String(err) })
      if (jobId) {
        bufferLog(jobId, { phase: 'doc_meta_final_failed', message: 'Doc‑Meta finales Update fehlgeschlagen' })
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'doc_meta_upsert_failed', attributes: { vectorFileId: fileId, error: String(err) } }) } catch {}
      }
      // Kritisch: Fehler weiterwerfen, damit Orchestrator den Step/Job als failed markiert
      throw err instanceof Error ? err : new Error(String(err))
    }
    FileLogger.info('ingestion', 'Upsert abgeschlossen', { fileId, chunks: chunksUpserted, vectors: vectors.length, imageErrors: imageErrors?.length ?? 0 })
    if (jobId) bufferLog(jobId, { phase: 'ingest_pinecone_upserted', message: `Upsert abgeschlossen: ${chunksUpserted} Chunks (${vectors.length} Vektoren)` })
    return { chunksUpserted, docUpserted: true, index: ctx.vectorIndex, imageErrors: imageErrors ?? undefined }
  }
}


