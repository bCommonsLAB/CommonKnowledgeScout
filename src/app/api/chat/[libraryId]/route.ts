import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors, listVectors } from '@/lib/chat/pinecone'
import { getByFileIds, computeDocMetaCollectionName } from '@/lib/repositories/doc-meta-repo'
import { startQueryLog, appendRetrievalStep as logAppend, setPrompt as logSetPrompt, finalizeQueryLog, failQueryLog, markStepStart, markStepEnd } from '@/lib/logging/query-logger'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { buildFilters } from '@/lib/chat/common/filters'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  answerLength: z.enum(['kurz','mittel','ausführlich','unbegrenzt']).default('mittel')
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // Auth prüfen oder public zulassen (abhängig von Config)
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    // Fallback: erlauben wir public nur, wenn Chat public konfiguriert ist
    const emailForLoad = userEmail || request.headers.get('X-User-Email') || ''

    if (!emailForLoad) {
      // Wir laden trotzdem, um public-Flag zu prüfen
      // Wenn kein userEmail vorliegt und Chat nicht public ist → 401
    }

    const ctx = await loadLibraryChatContext(emailForLoad, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    if (!ctx.chat.public && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Body validieren
    const json = await request.json().catch(() => ({}))
    const body = chatRequestSchema.safeParse(json)
    if (!body.success) {
      return NextResponse.json({ error: 'Ungültige Anfrage', details: body.error.flatten() }, { status: 400 })
    }

    const { message, answerLength } = body.data

    // Optional: Filter aus Query (Facetten im Chat-Kontext wiederverwenden)
    const parsedUrl = new URL(request.url)
    const author = parsedUrl.searchParams.getAll('author')
    const region = parsedUrl.searchParams.getAll('region')
    const year = parsedUrl.searchParams.getAll('year')
    const docType = parsedUrl.searchParams.getAll('docType')
    const source = parsedUrl.searchParams.getAll('source')
    const tag = parsedUrl.searchParams.getAll('tag')
    const retriever = (parsedUrl.searchParams.get('retriever') || 'chunk').toLowerCase() === 'doc' ? 'doc' : 'chunk'
    // Retriever: chunk (Standard) oder doc (Dokument-Summaries)
    const kindValue = retriever === 'doc' ? 'chapterSummary' : 'chunk'
    // Normalisierte Filter (mit libraryId für Nachvollziehbarkeit)
    const normalizedFilter: Record<string, unknown> = {
      user: { $eq: userEmail || '' },
      libraryId: { $eq: libraryId },
      kind: { $eq: kindValue }
    }
    // Effektiver Pinecone-Filter: Im Summaries-Modus libraryId weglassen (nicht immer vorhanden)
    const baseFilter: Record<string, unknown> = retriever === 'doc'
      ? { user: { $eq: userEmail || '' }, kind: { $eq: 'chapterSummary' } }
      : { ...normalizedFilter }
    if (author.length > 0) baseFilter['authors'] = { $in: author }
    if (region.length > 0) baseFilter['region'] = { $in: region }
    if (year.length > 0) baseFilter['year'] = { $in: year.map(y => (isNaN(Number(y)) ? y : Number(y))) }
    if (docType.length > 0) baseFilter['docType'] = { $in: docType }
    if (source.length > 0) baseFilter['source'] = { $in: source }
    if (tag.length > 0) baseFilter['tags'] = { $in: tag }

    // Query-Logging initialisieren (muss vor allen logAppend-Aufrufen stehen)
    const facetsSelected: Record<string, unknown> = {}
    parsedUrl.searchParams.forEach((v, k) => {
      if (!facetsSelected[k]) facetsSelected[k] = [] as unknown[]
      ;(facetsSelected[k] as unknown[]).push(v)
    })

    // Neuer Pfad: explizit angeforderter Summary-Retriever über Mongo (retriever=summary)
    const retrieverParamRaw = (parsedUrl.searchParams.get('retriever') || '').toLowerCase()
    if (retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc') {
      const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, 'summary')
      const modeNow = 'summaries' as const
      const queryId = await startQueryLog({
        libraryId,
        userEmail: emailForLoad,
        question: message,
        mode: modeNow,
        facetsSelected,
        filtersNormalized: { ...built.normalized },
        filtersPinecone: { ...built.pinecone },
      })
      const { answer, sources } = await runChatOrchestrated({
        retriever: 'summary',
        libraryId,
        userEmail: emailForLoad,
        question: message,
        answerLength,
        filters: built.mongo,
        queryId,
        context: { vectorIndex: ctx.vectorIndex }
      })
      return NextResponse.json({
        status: 'ok',
        libraryId,
        vectorIndex: ctx.vectorIndex,
        answer,
        sources,
        queryId,
      })
    }
    const mode = retriever === 'doc' ? 'summaries' : 'chunks' as const
    const queryId = await startQueryLog({
      libraryId,
      userEmail: emailForLoad,
      question: message,
      mode,
      facetsSelected,
      filtersNormalized: { ...normalizedFilter },
      filtersPinecone: { ...baseFilter },
    })

    // Embedding nur, wenn nicht Summaries-Modus (dort wird nicht gerankt)
    let qVec: number[] | undefined = undefined
    if (mode !== 'summaries') {
      let stepEmbed = markStepStart({ indexName: ctx.vectorIndex, namespace: '', stage: 'embed', level: 'question' })
      ;[qVec] = await embedTexts([message])
      stepEmbed = markStepEnd(stepEmbed)
      await logAppend(queryId, { indexName: ctx.vectorIndex, namespace: '', stage: 'embed', level: 'question', timingMs: stepEmbed.timingMs, startedAt: stepEmbed.startedAt, endedAt: stepEmbed.endedAt })
    }

    // Pinecone Query
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    const baseTopK = 20

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0

    const retrievalStartAll = Date.now()
    if (retriever === 'doc') {
      const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
      const libraryKey = computeDocMetaCollectionName(userEmail || '', libraryId, strategy)
      // Summaries-Modus: keine Ranking-Query, wir listen und filtern clientseitig
      let step = markStepStart({ indexName: ctx.vectorIndex, namespace: '', stage: 'list', level: 'summary', filtersEffective: { normalized: { ...normalizedFilter }, pinecone: {} } })
      const all = await listVectors(idx.host, apiKey, undefined)
      const usedDocs = all.filter(d => {
        const meta = (d.metadata || {}) as Record<string, unknown>
        const userOk = typeof (meta as { user?: unknown }).user === 'string' ? ((meta as { user: string }).user === (userEmail || '')) : true
        const kindOk = (meta as { kind?: unknown }).kind === 'chapterSummary'
        const libMeta = (meta as { libraryId?: unknown }).libraryId
        const libOk = libMeta ? libMeta === libraryId : true
        return userOk && kindOk && libOk
      })
      step = markStepEnd({ ...step, topKReturned: usedDocs.length })
      await logAppend(queryId, {
        indexName: ctx.vectorIndex,
        namespace: '',
        stage: 'list',
        level: 'summary',
        filtersEffective: { normalized: { ...normalizedFilter }, pinecone: {} },
        topKReturned: usedDocs.length,
        timingMs: step.timingMs,
        startedAt: step.startedAt,
        endedAt: step.endedAt,
        results: usedDocs.slice(0, 20).map((d) => ({ id: d.id, type: 'summary', metadata: d.metadata })),
      })

      const fileIds = usedDocs
        .map(d => (d.metadata && typeof d.metadata === 'object' ? (d.metadata as { fileId?: unknown }).fileId : undefined))
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
      const metaMap = await getByFileIds(libraryKey, libraryId, fileIds)
      for (const d of usedDocs) {
        const meta = (d.metadata || {}) as Record<string, unknown>
        const fileId = typeof (meta as { fileId?: unknown }).fileId === 'string' ? (meta as { fileId: string }).fileId : undefined
        const m = fileId ? metaMap.get(fileId) : undefined
        const chapterTitle = typeof (meta as { chapterTitle?: unknown }).chapterTitle === 'string' ? (meta as { chapterTitle: string }).chapterTitle : undefined
        const text = typeof (meta as { text?: unknown }).text === 'string' ? (meta as { text: string }).text : undefined
        const summaryShort = typeof (meta as { summaryShort?: unknown }).summaryShort === 'string' ? (meta as { summaryShort: string }).summaryShort : undefined
        const vectorText = text || summaryShort
        let fileName = typeof (meta as { fileName?: unknown }).fileName === 'string' ? (meta as { fileName: string }).fileName : undefined
        let composed = vectorText ? `${chapterTitle ? `Kapitel: ${chapterTitle}\n` : ''}${String(vectorText).slice(0, 900)}` : ''
        if (!composed && m) {
          const docMeta = (m.docMetaJson || {}) as Record<string, unknown>
          const title = typeof (docMeta as { title?: unknown }).title === 'string' ? (docMeta as { title: string }).title : undefined
          const shortTitle = typeof (docMeta as { shortTitle?: unknown }).shortTitle === 'string' ? (docMeta as { shortTitle: string }).shortTitle : undefined
          const summary = typeof (docMeta as { summary?: unknown }).summary === 'string' ? (docMeta as { summary: string }).summary : undefined
          composed = [chapterTitle ? `Kapitel: ${chapterTitle}` : undefined, title ? `Titel: ${title}` : undefined, shortTitle ? `Kurz: ${shortTitle}` : undefined, summary ? `Zusammenfassung: ${String(summary).slice(0, 900)}` : undefined].filter(Boolean).join('\n')
          fileName = fileName || m.fileName || title || shortTitle
        }
        if (!composed) continue
        if (used + composed.length > charBudget) break
        sources.push({ id: d.id, fileName, text: composed })
        used += composed.length
      }
    } else {
      // Parallel: chunk-Query und summary-Query starten
      const chunkTask = (async () => {
        let s = markStepStart({ indexName: ctx.vectorIndex, namespace: '', stage: 'query', level: 'chunk', filtersEffective: { normalized: { ...baseFilter }, pinecone: { ...baseFilter } }, queryVectorInfo: { source: 'question' } })
        const res = await queryVectors(idx.host, apiKey, (qVec as number[]), baseTopK, baseFilter)
        s = markStepEnd({ ...s, topKRequested: baseTopK, topKReturned: res.length })
        return { matches: res, step: s }
      })()

      const summaryTask = (async () => {
        try {
          let s = markStepStart({ indexName: ctx.vectorIndex, namespace: '', stage: 'query', level: 'summary', filtersEffective: { normalized: { ...baseFilter, kind: { $eq: 'chapterSummary' } }, pinecone: { ...baseFilter, kind: { $eq: 'chapterSummary' } } }, queryVectorInfo: { source: 'question' } })
          const res = await queryVectors(idx.host, apiKey, (qVec as number[]), 10, { ...baseFilter, kind: { $eq: 'chapterSummary' } })
          s = markStepEnd({ ...s, topKRequested: 10, topKReturned: res.length })
          return { chapterMatches: res, step: s }
        } catch {
          return { chapterMatches: [] as Awaited<ReturnType<typeof queryVectors>>, step: undefined as unknown as ReturnType<typeof markStepStart> }
        }
      })()

      const [{ matches, step: stepQ }, { chapterMatches, step: stepC }] = await Promise.all([chunkTask, summaryTask])

      await logAppend(queryId, {
        indexName: ctx.vectorIndex,
        namespace: '',
        stage: 'query',
        level: 'chunk',
        topKRequested: baseTopK,
        topKReturned: matches.length,
        filtersEffective: { normalized: { ...baseFilter }, pinecone: { ...baseFilter } },
        queryVectorInfo: { source: 'question' },
        timingMs: stepQ.timingMs,
        startedAt: stepQ.startedAt,
        endedAt: stepQ.endedAt,
        results: matches.slice(0, 20).map(m => ({ id: m.id, type: 'chunk', score: m.score, metadata: m.metadata })),
      })

      // Kapitel-Summaries Boost
      const chapterBoost = new Map<string, number>()
      if (Array.isArray(chapterMatches) && chapterMatches.length > 0) {
        await logAppend(queryId, {
          indexName: ctx.vectorIndex,
          namespace: '',
          stage: 'query',
          level: 'summary',
          topKRequested: 10,
          topKReturned: chapterMatches.length,
          filtersEffective: { normalized: { ...baseFilter, kind: { $eq: 'chapterSummary' } }, pinecone: { ...baseFilter, kind: { $eq: 'chapterSummary' } } },
          queryVectorInfo: { source: 'question' },
          timingMs: stepC?.timingMs,
          startedAt: stepC?.startedAt,
          endedAt: stepC?.endedAt,
          results: chapterMatches.slice(0, 20).map(m => ({ id: m.id, type: 'summary', score: m.score, metadata: m.metadata })),
        })
        const base = 1.0
        const step = 0.05
        chapterMatches.forEach((m, i) => {
          const meta = (m.metadata ?? {}) as Record<string, unknown>
          const chapterId = typeof meta.chapterId === 'string' ? meta.chapterId : undefined
          if (!chapterId) return
          const score = base - i * step
          if (!chapterBoost.has(chapterId)) chapterBoost.set(chapterId, Math.max(0, score))
        })
      }

      const scoreMap = new Map<string, number>()
      for (const m of matches) scoreMap.set(m.id, typeof m.score === 'number' ? m.score : 0)

      // Nachbarn sammeln (±w)
      const windowByLength = answerLength === 'ausführlich' ? 3 : answerLength === 'mittel' ? 2 : 1
      const idSet = new Set<string>()
      const parseId = (id: string) => {
        const idx = id.lastIndexOf('-')
        if (idx < 0) return { base: id, chunk: NaN }
        return { base: id.slice(0, idx), chunk: Number(id.slice(idx+1)) }
      }
      const toId = (base: string, chunk: number) => `${base}-${chunk}`
      for (const m of matches) {
        const { base, chunk } = parseId(m.id)
        if (!Number.isFinite(chunk)) { idSet.add(m.id); continue }
        for (let d = -windowByLength; d <= windowByLength; d++) {
          idSet.add(toId(base, chunk + d))
        }
      }
      const ids = Array.from(idSet)
      let stepF = markStepStart({ indexName: ctx.vectorIndex, namespace: '', stage: 'fetchNeighbors', level: 'chunk' })
      const fetched = await fetchVectors(idx.host, apiKey, ids)
      stepF = markStepEnd({ ...stepF, topKRequested: ids.length, topKReturned: Object.keys(fetched).length })
      await logAppend(queryId, {
        indexName: ctx.vectorIndex,
        namespace: '',
        stage: 'fetchNeighbors',
        level: 'chunk',
        topKRequested: ids.length,
        topKReturned: Object.keys(fetched).length,
        timingMs: stepF.timingMs,
        startedAt: stepF.startedAt,
        endedAt: stepF.endedAt,
      })
      const chapterAlpha = Number(process.env.CHAT_CHAPTER_BOOST ?? 0.15)
      const vectorRows = ids
        .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata as Record<string, unknown> | undefined }))
        .filter(r => r.meta)
        .map(r => {
          const meta = r.meta!
          const chapterId = typeof meta.chapterId === 'string' ? meta.chapterId : undefined
          let boosted = r.score
          if (chapterId && chapterBoost.size > 0) {
            const b = chapterBoost.get(chapterId)
            if (typeof b === 'number') boosted = boosted + chapterAlpha * b
          }
          // kleiner lexikalischer Boost auf Titel/Keywords
          try {
            const q = message.toLowerCase()
            const title = typeof meta.chapterTitle === 'string' ? meta.chapterTitle.toLowerCase() : ''
            const kws = Array.isArray(meta.keywords) ? (meta.keywords as unknown[]).filter(v => typeof v === 'string').map(v => (v as string).toLowerCase()) : []
            let lex = 0
            if (title && q && title.includes(q)) lex += 0.02
            for (const kw of kws) if (kw && q.includes(kw)) { lex += 0.02; if (lex > 0.06) break }
            boosted += lex
          } catch { /* noop */ }
          return { ...r, score: boosted }
        })
        .sort((a, b) => (b.score - a.score))

      for (const r of vectorRows) {
        const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
        const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
        const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
        const score = r.score
        if (!t) continue
        if (used + t.length > charBudget) break
        // Optional Kapitel-Meta in den Snippets voranstellen
        if (process.env.CHAT_INCLUDE_CHAPTER_META === '1') {
          const chapterTitle = typeof r.meta!.chapterTitle === 'string' ? r.meta!.chapterTitle : undefined
          const summaryShort = typeof r.meta!.summaryShort === 'string' ? r.meta!.summaryShort : undefined
          const pre = `${chapterTitle ? `Kapitel: ${chapterTitle}\n` : ''}${summaryShort ? `Summary: ${summaryShort.slice(0, 240)}\n\n` : ''}`
          sources.push({ id: r.id, score, fileName, chunkIndex, text: pre + t })
        } else {
          sources.push({ id: r.id, score, fileName, chunkIndex, text: t })
        }
        used += t.length
      }

      // Fallback: Wenn keine Quellen aus fetchVectors, versuche Matches-Metadaten zu verwenden
      if (sources.length === 0) {
        let acc = 0
        const fallback: typeof sources = []
        for (const m of matches) {
          const meta = (m?.metadata ?? {}) as Record<string, unknown>
          const t = typeof meta.text === 'string' ? meta.text as string : ''
          if (!t) continue
          const fileName = typeof meta.fileName === 'string' ? meta.fileName as string : undefined
          const chunkIndex = typeof meta.chunkIndex === 'number' ? meta.chunkIndex as number : undefined
          const score = m.score
          const snippet = t.slice(0, 1000)
          const len = snippet.length
          if (acc + len > charBudget) break
          fallback.push({ id: String(m.id), score, fileName, chunkIndex, text: snippet })
          acc += len
        }
        if (fallback.length > 0) {
          sources = fallback
        }
      }
    }
    const retrievalMs = Date.now() - retrievalStartAll

    // Wenn weiterhin keine Quellen gefunden wurden, antworte standardisiert – aber Log finalisieren und queryId zurückgeben
    if (sources.length === 0) {
      await finalizeQueryLog(queryId, {
        answer: 'Keine passenden Inhalte gefunden',
        sources: [],
        timing: { retrievalMs, llmMs: 0, totalMs: retrievalMs },
      })
      return NextResponse.json({
        status: 'ok',
        libraryId,
        vectorIndex: ctx.vectorIndex,
        answer: 'Keine passenden Inhalte gefunden',
        sources: [],
        queryId,
      })
    }

    // Kontext bauen
    const buildContext = (srcs: typeof sources, perSnippetLimit = 800) => srcs
      .map((s, i) => `Quelle [${i + 1}] ${s.fileName ?? s.id} (Chunk ${s.chunkIndex ?? '-'}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`)
      .join('\n\n')
    let context = buildContext(sources)

    // OpenAI Chat Call
    const chatApiKey = process.env.OPENAI_API_KEY
    if (!chatApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })
    const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
    const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.3)

    // Stilvorgaben je nach gewünschter Antwortlänge
    const styleInstruction = answerLength === 'ausführlich'
      ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter): Beginne mit 1–2 Sätzen Zusammenfassung, danach Details in Absätzen oder Stichpunkten. Vermeide Füllwörter.'
      : answerLength === 'mittel'
      ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter): 3–6 Sätze oder eine kurze Liste der wichtigsten Punkte. Direkt und präzise.'
      : answerLength === 'kurz'
      ? 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter). Keine Einleitung, direkt die Kernaussage.'
      : 'Formuliere eine vollständige, gut strukturierte Antwort. Du darfst so lang antworten, wie nötig; bleibe aber fokussiert auf die Frage.'

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- ${styleInstruction}\n- Fachlich korrekt, ohne Spekulationen.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`
    await logSetPrompt(queryId, { provider: 'openai', model, temperature, prompt })

    const callChat = async (currPrompt: string) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${chatApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: 'Du bist ein hilfreicher, faktenbasierter Assistent.' },
            { role: 'user', content: currPrompt }
          ]
        })
      })
      return res
    }

    // Optionales Server-Debugging: nur aktiv, wenn der Client X-Debug: 1 sendet oder nicht production
    const debug = request.headers.get('X-Debug') === '1' || process.env.NODE_ENV !== 'production'
    if (debug) {
      const usedChars = sources.reduce((sum, s) => sum + (s.text?.length ?? 0), 0)
      // eslint-disable-next-line no-console
      console.log('[api/chat] params', { answerLength, baseBudget, topK: baseTopK, used: usedChars, sources: sources.length, retriever })
      // eslint-disable-next-line no-console
      console.log('[api/chat] sources', sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score, textChars: s.text?.length ?? 0 })))
      // eslint-disable-next-line no-console
      console.log('[api/chat] openai request', { model, temperature, promptChars: prompt.length, contextChars: context.length, style: answerLength })
    }

    const tL0 = Date.now()
    let stepLLM = markStepStart({ indexName: ctx.vectorIndex, namespace: '', stage: 'llm', level: 'answer' })
    let chatRes = await callChat(prompt)
    if (!chatRes.ok) {
      const text = await chatRes.text()
      const tooLong = text.includes('maximum context length') || chatRes.status === 400
      if (tooLong) {
        // Reduziere Budget schrittweise und versuche erneut
        const budgets = answerLength === 'ausführlich' ? [120000, 90000, 60000, 30000] : answerLength === 'mittel' ? [60000, 30000] : [20000]
        let retried = false
        for (const b of budgets) {
          if (b >= used) continue
          charBudget = b
          // Kürze Quellenliste
          let acc = 0
          const reduced: typeof sources = []
          for (const s of sources) {
            const len = s.text?.length ?? 0
            if (acc + len > charBudget) break
            reduced.push(s)
            acc += len
          }
          context = buildContext(reduced)
          const p2 = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- Antworte knapp und fachlich korrekt.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`
          chatRes = await callChat(p2)
          if (chatRes.ok) { retried = true; break }
        }
        if (!retried && !chatRes.ok) {
          return NextResponse.json({ error: `OpenAI Chat Fehler: ${chatRes.status} ${text.slice(0, 400)}` }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: `OpenAI Chat Fehler: ${chatRes.status} ${text.slice(0, 400)}` }, { status: 500 })
      }
    }
    const raw = await chatRes.text()
    let answer = ''
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
        const c = p.choices?.[0]?.message?.content
        if (typeof c === 'string') answer = c
      }
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }

    stepLLM = markStepEnd(stepLLM)
    await logAppend(queryId, {
      indexName: ctx.vectorIndex,
      namespace: '',
      stage: 'llm',
      level: 'answer',
      timingMs: stepLLM.timingMs,
      startedAt: stepLLM.startedAt,
      endedAt: stepLLM.endedAt,
    })
    await finalizeQueryLog(queryId, {
      answer,
      sources: sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score })),
      timing: { retrievalMs, llmMs: Date.now() - tL0, totalMs: undefined },
    })

    return NextResponse.json({
      status: 'ok',
      libraryId,
      vectorIndex: ctx.vectorIndex,
      answer,
      sources,
      queryId,
    })
  } catch (error) {
    // Detailliertes Logging und dev-Details zurückgeben
    // eslint-disable-next-line no-console
    console.error('[api/chat] Unhandled error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    })
    try {
      // Wenn queryId im Scope war, Fehler persistieren (best-effort)
      const maybe = (error as unknown) as { queryId?: string }
      if (maybe && typeof maybe.queryId === 'string') {
        await failQueryLog(maybe.queryId, { message: error instanceof Error ? error.message : String(error) })
      }
    } catch {}
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}


