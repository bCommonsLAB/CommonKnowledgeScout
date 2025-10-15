import { randomUUID } from 'crypto'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, upsertVectorsChunked, deleteByFilter } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { FileLogger } from '@/lib/debug/logger'
import { splitByPages } from '@/lib/ingestion/page-split'
import { chunkText } from '@/lib/text/chunk'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

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
  static async upsertMarkdown(
    userEmail: string,
    libraryId: string,
    fileId: string,
    fileName: string,
    markdown: string,
    meta?: Record<string, unknown>,
    jobId?: string,
  ): Promise<{ chunksUpserted: number; docUpserted: boolean; index: string }> {
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) throw new Error('Bibliothek nicht gefunden')

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')

    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) throw new Error('Index nicht gefunden oder ohne Host')

    // Frontmatter nicht chunken – nur Dokumentkörper
    const body = (() => {
      // Strenger Frontmatter-Block nur am Dokumentanfang: ---\n ... \n---\n
      const re = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/m
      return re.test(markdown) ? markdown.replace(re, '') : markdown
    })()
    let spans = splitByPages(body)
    if (!Array.isArray(spans) || spans.length === 0) {
      // Fallback: Gesamten Body als eine Seite behandeln
      spans = [{ page: 1, startIdx: 0, endIdx: body.length }]
    }
    // Bevorzugt deklarierte Seitenzahl aus Meta (Frontmatter)
    const declaredPagesRaw = meta && typeof meta === 'object' ? (meta as { pages?: unknown }).pages : undefined
    const declaredPages = typeof declaredPagesRaw === 'number' && declaredPagesRaw > 0 ? declaredPagesRaw : undefined
    const totalPages = declaredPages || spans.length
    FileLogger.info('ingestion', 'Start kapitelgeführte Ingestion', { libraryId, fileId, pages: totalPages })
    if (jobId) bufferLog(jobId, { phase: 'ingest_start', message: `Ingestion start (pages=${totalPages})` })
    // Kapitel aus Meta lesen
    const chaptersRaw = meta && typeof meta === 'object' ? (meta as { chapters?: unknown }).chapters : undefined
    const chaptersInput = Array.isArray(chaptersRaw) ? chaptersRaw as Array<Record<string, unknown>> : []

    // Idempotenz: Alte Vektoren dieses Dokuments löschen
    await deleteByFilter(idx.host, apiKey, { user: { $eq: userEmail }, libraryId: { $eq: libraryId }, fileId: { $eq: fileId } })
    FileLogger.info('ingestion', 'Vorherige Vektoren gelöscht', { fileId })
    if (jobId) bufferLog(jobId, { phase: 'indextidy', message: 'Alte Vektoren entfernt' })

    const vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
    let globalChunkIndex = 0

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

    // Doc‑Meta als eigener Vektor erneut upserten (nach indextidy)
    const upsertedAtDoc = new Date().toISOString()
    let docMetaVector: { id: string; values: number[]; metadata: Record<string, unknown> } | null = null
    try {
      const dim = typeof (idx as unknown as { dimension?: unknown }).dimension === 'number'
        ? Number((idx as unknown as { dimension: number }).dimension)
        : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)
      const zero = new Array<number>(dim).fill(0)
      zero[0] = 1
      const docMeta: Record<string, unknown> = {
        kind: 'doc',
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        upsertedAt: upsertedAtDoc,
        docMetaJson: JSON.stringify(meta || {}),
      }
      docMetaVector = { id: `${fileId}-meta`, values: zero, metadata: docMeta }
      vectors.push(docMetaVector)
    } catch (err) {
      FileLogger.warn('ingestion', 'Doc‑Meta Vektor konnte nicht vorbereitet werden', { fileId, err: String(err) })
    }

    // Hilfsfunktionen für tolerantes Evidence‑Match
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const firstWords = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ')
    const buildEvidenceRegex = (snippet: string) => {
      const words = firstWords(snippet, 10)
        // Entferne grob Satz- und Sonderzeichen ohne Unicode-Property Escapes
        .replace(/[\u2000-\u206F\u2E00-\u2E7F'".,!?;:()\[\]{}<>@#$%^&*_+=~`|\\/\-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(escapeRegExp)
      if (words.length === 0) return null
      // Erlaube beliebige Nicht‑Wort‑Trenner zwischen den Wörtern
      const pattern = words.join('\\W+')
      return new RegExp(pattern, 'i')
    }
    // Keine Reparaturlogik mehr hier: Ingestion erwartet normalisierte Kapitel aus Analyze‑Endpoint
    const chapters = chaptersInput
    if (jobId) {
      const stats = (() => {
        let missingStart = 0, missingEnd = 0, okRangeHint = 0
        for (const c of chapters) {
          const sp = typeof (c as { startPage?: unknown }).startPage === 'number'
          const ep = typeof (c as { endPage?: unknown }).endPage === 'number'
          if (!sp) missingStart += 1
          if (!ep) missingEnd += 1
          if (sp && ep) okRangeHint += 1
        }
        return { total: chapters.length, missingStart, missingEnd, okRangeHint }
      })()
      bufferLog(jobId, { phase: 'chapters_input', message: `Kapitel übergeben: ${chapters.length}`, details: stats as unknown as Record<string, unknown> })
    }

    // Coverage‑Tracking (nur für Diagnose)
    const pageCovered: boolean[] = new Array<boolean>(Math.max(1, totalPages)).fill(false)

    for (const ch of chapters) {
      const title = typeof (ch as { title?: unknown }).title === 'string' ? (ch as { title: string }).title : 'Kapitel'
      const level = typeof (ch as { level?: unknown }).level === 'number' ? (ch as { level: number }).level : undefined
      const order = typeof (ch as { order?: unknown }).order === 'number' ? (ch as { order: number }).order : undefined
      let startPage = typeof (ch as { startPage?: unknown }).startPage === 'number' ? (ch as { startPage: number }).startPage : undefined
      let endPage = typeof (ch as { endPage?: unknown }).endPage === 'number' ? (ch as { endPage: number }).endPage : undefined
      const pageCount = typeof (ch as { pageCount?: unknown }).pageCount === 'number' ? (ch as { pageCount: number }).pageCount : undefined
      const startEvidence = typeof (ch as { startEvidence?: unknown }).startEvidence === 'string' ? (ch as { startEvidence: string }).startEvidence : ''
      const summary = typeof (ch as { summary?: unknown }).summary === 'string' ? (ch as { summary: string }).summary : ''
      const keywords = toStrArr((ch as { keywords?: unknown }).keywords)

      // Toleranter Fallback: Single‑Page setzen, ansonsten clamping auf bekannte Grenzen
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
        const rx = buildEvidenceRegex(startEvidence)
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

      embeds.forEach((values, localIdx) => {
        const id = `${fileId}-${globalChunkIndex}`
        const metadata: Record<string, unknown> = {
          kind: 'chunk', user: userEmail, libraryId, fileId, fileName,
          chunkIndex: globalChunkIndex, text: safeText(chunkTexts[localIdx], 1200), upsertedAt,
          chapterId, chapterOrder: order, chapterTitle: title, level,
          startPage, endPage, pageCount, summaryShort: safeText(summary, 320), keywords,
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

    // Kompakter Fortschritt nach dem Chunking
    const chunksPlanned = vectors.filter(v => (v.metadata?.kind === 'chunk')).length
    if (jobId) bufferLog(jobId, { phase: 'ingest_chunking_done', message: `Chunking abgeschlossen: ${chunksPlanned} Chunks, ${vectors.length} Vektoren` })

    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)
    const chunksUpserted = vectors.filter(v => (v.metadata?.kind === 'chunk')).length
    // Doc‑Meta finalisieren: counts + ingest_status + upsertedAt
    try {
      const chaptersCount = chapters.length
      const finalMeta: Record<string, unknown> = {
        kind: 'doc', user: userEmail, libraryId, fileId, fileName,
        chunkCount: chunksUpserted, chaptersCount,
        ingest_status: 'completed',
        upsertedAt: new Date().toISOString(),
      }
      if (docMetaVector) {
        docMetaVector.metadata = { ...docMetaVector.metadata, ...finalMeta }
        await upsertVectorsChunked(idx.host, apiKey, [docMetaVector], 1)
      } else {
        // Falls kein früheres docMetaVector vorhanden war: lege eines an
        const dim = typeof (idx as unknown as { dimension?: unknown }).dimension === 'number' ? (idx as unknown as { dimension: number }).dimension : 3072
        const unit = new Array<number>(dim).fill(0); unit[0] = 1
        await upsertVectorsChunked(idx.host, apiKey, [{ id: `${fileId}-meta`, values: unit, metadata: finalMeta }], 1)
      }
    } catch (err) {
      FileLogger.warn('ingestion', 'Doc‑Meta finales Update fehlgeschlagen', { fileId, err: String(err) })
    }
    FileLogger.info('ingestion', 'Upsert abgeschlossen', { fileId, chunks: chunksUpserted, vectors: vectors.length })
    if (jobId) bufferLog(jobId, { phase: 'ingest_pinecone_upserted', message: `Upsert abgeschlossen: ${chunksUpserted} Chunks (${vectors.length} Vektoren)` })
    return { chunksUpserted, docUpserted: true, index: ctx.vectorIndex }
  }
}


