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
      const m = markdown.match(/^---[\s\S]*?---\s*/m)
      return m ? markdown.slice(m[0].length) : markdown
    })()
    const pages = splitByPages(body)
    const totalPages = pages.length
    FileLogger.info('ingestion', 'Start kapitelgeführte Ingestion', { libraryId, fileId, pages: pages.length })
    if (jobId) bufferLog(jobId, { phase: 'ingest_start', message: `Ingestion start (pages=${pages.length})` })
    // Kapitel aus Meta lesen
    const chaptersRaw = meta && typeof meta === 'object' ? (meta as { chapters?: unknown }).chapters : undefined
    const chapters = Array.isArray(chaptersRaw) ? chaptersRaw as Array<Record<string, unknown>> : []

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

    // Hilfsfunktionen für tolerantens Evidence‑Match
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const firstWords = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ')
    const buildEvidenceRegex = (snippet: string) => {
      const words = firstWords(snippet, 10)
        .normalize('NFKD')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(escapeRegExp)
      if (words.length === 0) return null
      // Erlaube beliebige Nicht‑Wort‑Trenner zwischen den Wörtern
      const pattern = words.join('\\W+')
      return new RegExp(pattern, 'i')
    }

    // Coverage‑Tracking pro Seite (0..n-1)
    const pageCovered: boolean[] = new Array<boolean>(totalPages).fill(false)

    for (const ch of chapters) {
      const title = typeof ch.title === 'string' ? ch.title : 'Kapitel'
      const level = typeof ch.level === 'number' ? ch.level : undefined
      const order = typeof ch.order === 'number' ? ch.order : undefined
      let startPage = typeof ch.startPage === 'number' ? ch.startPage : undefined
      let endPage = typeof ch.endPage === 'number' ? ch.endPage : undefined
      const pageCount = typeof ch.pageCount === 'number' ? ch.pageCount : undefined
      const startEvidence = typeof (ch as { startEvidence?: unknown }).startEvidence === 'string' ? (ch as { startEvidence: string }).startEvidence : ''
      const summary = typeof ch.summary === 'string' ? ch.summary : ''
      const keywords = toStrArr((ch as { keywords?: unknown }).keywords)

      // Fallback: wenn endPage fehlt, setze auf startPage (Single‑Page‑Kapitel)
      if (startPage && !endPage) endPage = startPage
      if (!(startPage && endPage && startPage <= endPage)) {
        if (jobId) bufferLog(jobId, { phase: 'chapters_invalid_range', message: `Kapitel ${order ?? '-'}: ungültiger Bereich (${String(startPage)}-${String(endPage)})` })
        continue
      }

      // Seitenbereich zusammensetzen
      const segs = pages.filter(p => p.page >= startPage && p.page <= endPage)
      if (segs.length === 0) {
        if (jobId) bufferLog(jobId, { phase: 'chapters_page_not_found', message: `Kapitel ${order ?? '-'}: Seitenbereich fehlt (${startPage}-${endPage})` })
        continue
      }
      // Tolerantes Evidence‑Matching am Start der ersten Seite
      // Evidence nur zur Validierung verwenden; immer die ganze Startseite nehmen,
      // damit vorangestellte Überschriften erhalten bleiben.
      if (startEvidence) {
        const pageText = body.slice(segs[0].startIdx, segs[0].endIdx)
        const rx = buildEvidenceRegex(startEvidence)
        if (rx) {
          const found = pageText.search(rx)
          if (jobId) {
            if (found >= 0) bufferLog(jobId, { phase: 'chapters_start_present', message: `Kapitel ${order ?? '-'}: Evidence auf Startseite vorhanden`, details: { page: segs[0].page } })
            else bufferLog(jobId, { phase: 'chapters_start_absent', message: `Kapitel ${order ?? '-'}: Evidence auf Startseite nicht gefunden`, details: { page: segs[0].page } })
          }
        }
      }
      const firstSlice = body.slice(segs[0].startIdx, segs[0].endIdx)
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
          kind: 'chunk',
          user: userEmail,
          libraryId,
          fileId,
          fileName,
          chunkIndex: globalChunkIndex,
          text: safeText(chunkTexts[localIdx], 1200),
          upsertedAt,
          chapterId,
          chapterOrder: order,
          chapterTitle: title,
          level,
          startPage,
          endPage,
          pageCount,
          summaryShort: safeText(summary, 320),
          keywords,
        }
        vectors.push({ id, values, metadata })
        globalChunkIndex += 1
      })

      // Coverage markieren
      for (let p = startPage; p <= endPage; p++) pageCovered[p - 1] = true

      // Optional: Kapitel-Summary als eigener Vektor (für Reranking)
      if (summary) {
        const [sv] = await embedTexts([summary])
        vectors.push({
          id: `${fileId}-chap-${chapterId}`,
          values: sv,
          metadata: {
            kind: 'chapterSummary',
            user: userEmail,
            libraryId,
            fileId,
            fileName,
            chapterId,
            chapterTitle: title,
            order,
            startPage,
            endPage,
            text: safeText(summary, 1200),
            keywords,
            upsertedAt,
          } as Record<string, unknown>
        })
        FileLogger.info('ingestion', 'Kapitel-Summary vektorisiert', { fileId, order, title })
        if (jobId) bufferLog(jobId, { phase: 'chapters', message: `Kapitel ${order ?? '-'}: Summary vektorisiert` })
      }
    }

    // Orphan‑Seiten: alle nicht abgedeckten Seiten in sinnvoller Sequenz hinzufügen
    const orphanRanges: Array<{ from: number; to: number }> = []
    let runStart: number | null = null
    for (let i = 0; i < totalPages; i++) {
      if (!pageCovered[i]) {
        if (runStart === null) runStart = i
      } else if (runStart !== null) {
        orphanRanges.push({ from: runStart, to: i - 1 })
        runStart = null
      }
    }
    if (runStart !== null) orphanRanges.push({ from: runStart, to: totalPages - 1 })

    let orphanChunksTotal = 0
    for (let rIdx = 0; rIdx < orphanRanges.length; rIdx++) {
      const r = orphanRanges[rIdx]
      const text = body.slice(pages[r.from].startIdx, pages[r.to].endIdx)
      const chunks = chunkText(text, 1500, 100)
      if (chunks.length === 0) continue
      const embeds = await embedTexts(chunks)
      const upsertedAt = new Date().toISOString()
      embeds.forEach((values, localIdx) => {
        const id = `${fileId}-${globalChunkIndex}`
        const metadata: Record<string, unknown> = {
          kind: 'chunk', user: userEmail, libraryId, fileId, fileName,
          chunkIndex: globalChunkIndex, text: chunks[localIdx].slice(0, 1200), upsertedAt,
          chapterId: `orphan-${rIdx}`, chapterOrder: 10_000 + rIdx, chapterTitle: 'Sonstige Texte',
          startPage: pages[r.from].page, endPage: pages[r.to].page,
        }
        vectors.push({ id, values, metadata })
        globalChunkIndex += 1
      })
      orphanChunksTotal += chunks.length
    }
    if (jobId && orphanRanges.length > 0) bufferLog(jobId, { phase: 'orphan_pages_chunked', message: `Orphan‑Seiten gruppiert: ${orphanRanges.length} Bereiche, ${orphanChunksTotal} Chunks` })

    // Kompakter Fortschritt nach dem Chunking
    const chunksPlanned = vectors.filter(v => (v.metadata?.kind === 'chunk')).length
    if (jobId) bufferLog(jobId, { phase: 'ingest_chunking_done', message: `Chunking abgeschlossen: ${chunksPlanned} Chunks, ${vectors.length} Vektoren` })

    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)
    const chunksUpserted = vectors.filter(v => (v.metadata?.kind === 'chunk')).length
    // Doc‑Meta nachtragen/aktualisieren: chunkCount, chaptersCount
    try {
      if (docMetaVector) {
        const chaptersCount = chapters.filter(ch => typeof ch === 'object').length
        docMetaVector.metadata = { ...docMetaVector.metadata, chunkCount: chunksUpserted, chaptersCount }
        await upsertVectorsChunked(idx.host, apiKey, [docMetaVector], 1)
      }
    } catch (err) {
      FileLogger.warn('ingestion', 'Doc‑Meta Update (chunkCount) fehlgeschlagen', { fileId, err: String(err) })
    }
    FileLogger.info('ingestion', 'Upsert abgeschlossen', { fileId, chunks: chunksUpserted, vectors: vectors.length })
    if (jobId) bufferLog(jobId, { phase: 'ingest_pinecone_upserted', message: `Upsert abgeschlossen: ${chunksUpserted} Chunks (${vectors.length} Vektoren)` })
    return { chunksUpserted, docUpserted: true, index: ctx.vectorIndex }
  }
}


