import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors, listVectors } from '@/lib/chat/pinecone'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  answerLength: z.enum(['kurz','mittel','ausführlich']).default('mittel')
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

    // Embedding der Nutzerfrage
    const [qVec] = await embedTexts([message])

    // Pinecone Query
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    const baseTopK = 20
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
    const baseFilter: Record<string, unknown> = {
      user: { $eq: userEmail || '' },
      libraryId: { $eq: libraryId },
      kind: { $eq: retriever }
    }
    if (author.length > 0) baseFilter['authors'] = { $in: author }
    if (region.length > 0) baseFilter['region'] = { $in: region }
    if (year.length > 0) baseFilter['year'] = { $in: year.map(y => (isNaN(Number(y)) ? y : Number(y))) }
    if (docType.length > 0) baseFilter['docType'] = { $in: docType }
    if (source.length > 0) baseFilter['source'] = { $in: source }
    if (tag.length > 0) baseFilter['tags'] = { $in: tag }

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0

    if (retriever === 'doc') {
      // Kein Vektor-Query: Alle Dokument-Summaries (mit Metadaten-Filter) listen
      const docs = await listVectors(idx.host, apiKey, baseFilter as Record<string, unknown>)
      for (const d of docs) {
        const meta = d.metadata || {}
        let t = typeof meta.text === 'string' ? meta.text as string : ''
        let fileName = typeof meta.fileName === 'string' ? meta.fileName as string : undefined
        const docMetaJson = typeof meta.docMetaJson === 'string' ? meta.docMetaJson as string : undefined
        if (docMetaJson && !t) {
          try {
            const docMeta = JSON.parse(docMetaJson) as Record<string, unknown>
            const title = typeof docMeta.title === 'string' ? docMeta.title : undefined
            const shortTitle = typeof docMeta.shortTitle === 'string' ? docMeta.shortTitle : undefined
            const summary = typeof docMeta.summary === 'string' ? docMeta.summary : undefined
            const tags = Array.isArray(docMeta.tags) ? (docMeta.tags as unknown[]).filter(v => typeof v === 'string') as string[] : []
            const authors = Array.isArray(docMeta.authors) ? (docMeta.authors as unknown[]).filter(v => typeof v === 'string') as string[] : []
            fileName = fileName || title || shortTitle
            const parts = [
              title ? `Titel: ${title}` : undefined,
              shortTitle ? `Kurz: ${shortTitle}` : undefined,
              authors.length ? `Autoren: ${authors.join(', ')}` : undefined,
              summary ? `Zusammenfassung: ${summary}` : undefined,
              tags.length ? `Tags: ${tags.slice(0, 10).join(', ')}` : undefined,
            ].filter(Boolean) as string[]
            const composed = parts.join('\n')
            t = composed || t
          } catch {
            // ignore JSON parse
          }
        }
        if (!t) continue
        if (used + t.length > charBudget) break
        sources.push({ id: d.id, fileName, text: t })
        used += t.length
      }
    } else {
      const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, baseFilter)
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
      const fetched = await fetchVectors(idx.host, apiKey, ids)
      const vectorRows = ids
        .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata as Record<string, unknown> | undefined }))
        .filter(r => r.meta)
        .sort((a, b) => (b.score - a.score))

      for (const r of vectorRows) {
        let t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
        let fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
        const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
        const score = r.score
        if (!t) continue
        if (used + t.length > charBudget) break
        sources.push({ id: r.id, score, fileName, chunkIndex, text: t })
        used += t.length
      }

      // Fallback: Wenn keine Quellen aus fetchVectors, versuche Matches-Metadaten zu verwenden
      if (sources.length === 0) {
        let acc = 0
        const fallback: typeof sources = []
        for (const m of matches) {
          const meta = (m?.metadata ?? {}) as Record<string, unknown>
          let t = typeof meta.text === 'string' ? meta.text as string : ''
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

    // Wenn weiterhin keine Quellen gefunden wurden, antworte standardisiert
    if (sources.length === 0) {
      return NextResponse.json({
        status: 'ok',
        libraryId,
        vectorIndex: ctx.vectorIndex,
        answer: 'Keine passenden Inhalte gefunden',
        sources: [],
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
      : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter). Keine Einleitung, direkt die Kernaussage.'

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- ${styleInstruction}\n- Fachlich korrekt, ohne Spekulationen.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`

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

    return NextResponse.json({
      status: 'ok',
      libraryId,
      vectorIndex: ctx.vectorIndex,
      answer,
      sources,
    })
  } catch (error) {
    // Detailliertes Logging und dev-Details zurückgeben
    // eslint-disable-next-line no-console
    console.error('[api/chat] Unhandled error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    })
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}


