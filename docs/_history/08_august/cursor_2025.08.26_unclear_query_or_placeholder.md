# Unclear query or placeholder
_Exported on 8/30/2025 at 11:41:05 GMT+2 from Cursor (1.5.5)_

---

**User**

??

---

**Cursor**

Ich schaue mir zuerst die Chat-API Route an und suche nach Stellen, wo `response.json()` auf eine leere Antwort angewendet werden könnte. Dann öffne ich die relevante Datei.

Ich suche gezielt in der Chat-Route nach ungeschützt verwendeten res.json()-Aufrufen und lese die Datei vollständig, um die fehlerhafte Stelle zu identifizieren.

Ich werde mir die beteiligten Chat-Hilfsfunktionen (`loader`, `embeddings`, `pinecone`) anschauen, um ungesicherte `res.json()`-Aufrufe zu finden.

Ich habe die problematische Stelle identifiziert: mehrere Pinecone-Helper nutzen ungeschützt `res.json()`. Ich härte die JSON-Verarbeitung dort ab, indem ich leere Bodies und Parse-Fehler robust handhabe. Jetzt führe ich die Code-Änderung durch.

```typescript
export interface UpsertVector {
  id: string
  values: number[]
  metadata?: Record<string, unknown>
}

/**
 * Robustes JSON-Parsing für HTTP-Antworten.
 * - Leerer Body => {} statt SyntaxError
 * - Ungültiges JSON => wir werfen mit gekürztem Body für Debugging
 */
async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  const trimmed = text.trim()
  if (trimmed.length === 0) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`Ungueltiges JSON (Status ${res.status}): ${trimmed.slice(0, 400)}`)
  }
}

export async function upsertVectors(indexHost: string, apiKey: string, vectors: UpsertVector[]): Promise<void> {
  const url = `https://${indexHost}/vectors/upsert`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ vectors })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Upsert Fehler: ${res.status} ${err}`)
  }
}

/**
 * Upsert in kleinen Batches, um Pinecone 2MB Request-Limit einzuhalten.
 */
export async function upsertVectorsChunked(indexHost: string, apiKey: string, vectors: UpsertVector[], maxPerBatch: number = 10): Promise<void> {
  for (let i = 0; i < vectors.length; i += maxPerBatch) {
    const batch = vectors.slice(i, i + maxPerBatch)
    await upsertVectors(indexHost, apiKey, batch)
  }
}

export interface QueryMatch {
  id: string
  score?: number
  metadata?: Record<string, unknown>
}

export async function queryVectors(indexHost: string, apiKey: string, vector: number[], topK: number, filter?: Record<string, unknown>): Promise<QueryMatch[]> {
  const url = `https://${indexHost}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector, topK, includeMetadata: true, filter })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Query Fehler: ${res.status} ${err}`)
  }
  const data = await parseJsonSafe(res) as { matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> }
  const matches = Array.isArray(data?.matches) ? data.matches : []
  return matches.map((m: any) => ({ id: String(m.id), score: m.score, metadata: m.metadata }))
}

export async function fetchVectors(indexHost: string, apiKey: string, ids: string[]): Promise<Record<string, { id: string; metadata?: Record<string, unknown> }>> {
  const url = `https://${indexHost}/vectors/fetch`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, includeMetadata: true })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Fetch Fehler: ${res.status} ${err}`)
  }
  const data = await parseJsonSafe(res) as { vectors?: Record<string, { metadata?: Record<string, unknown> }> }
  const vectors = data?.vectors || {}
  const out: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
  for (const k of Object.keys(vectors)) {
    out[k] = { id: k, metadata: vectors[k]?.metadata }
  }
  return out
}

export async function describeIndex(indexName: string, apiKey: string): Promise<{ host: string } | null> {
  const res = await fetch(`https://api.pinecone.io/indexes/${encodeURIComponent(indexName)}`, {
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    cache: 'no-store'
  })
  if (!res.ok) return null
  const data = await parseJsonSafe(res) as { host?: string }
  const host: string | undefined = data?.host
  return host ? { host } : null
}

export async function deleteByFilter(indexHost: string, apiKey: string, filter: Record<string, unknown>): Promise<void> {
  const url = `https://${indexHost}/vectors/delete`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deleteAll: false, ids: [], filter })
  })
  // Wenn Namespace noch nicht existiert (erste Benutzung), kann Pinecone 404 "Namespace not found" liefern.
  // Das ist in diesem Fall unkritisch: Wir wollen ja nur sicherstellen, dass nichts Altes vorhanden ist.
  if (res.status === 404) {
    return
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Delete Fehler: ${res.status} ${err}`)
  }
}



```

Ich starte kurz die Tests, um sicherzustellen, dass der Fix keine Regressionen verursacht. Danach gebe ich dir eine kurze Einschätzung, wie wir das Verhalten manuell verifizieren können.

Ich führe jetzt die Tests ohne Pipe aus, um die Änderung zu verifizieren.

Ich habe den Fehler eingegrenzt und behoben. Kurzupdate: Die 500er mit “Unexpected end of JSON input” kommen von res.json() auf leeren HTTP-Bodies (undici-Stacktrace). Das passierte in unseren Pinecone-Helpern. Ich habe dort robustes JSON-Parsing eingeführt, sodass leere oder ungültige Antworten nicht mehr die Route crashen.

Analyse: In `src/lib/chat/pinecone.ts` wurde `res.json()` direkt verwendet. Liefert Pinecone 200 mit leerem Body (z. B. Transienten/Edge-Cases), wirft undici beim JSON-Parse. Der Chat-Route-Stack zeigt genau dieses Muster. Die Chat-Route selbst parst die OpenAI-Antwort bereits defensiv über `text()`+`JSON.parse` mit Try/Catch. Deshalb lag die Ursache sehr wahrscheinlich in `queryVectors`, `fetchVectors` oder `describeIndex`. Ich habe ein `parseJsonSafe` eingefügt, das leere Bodies als `{}` interpretiert und bei ungültigem JSON mit gekürztem Body-Inhalt wirft.

So prüfen wir das jetzt manuell:
- PowerShell (Beispiel):  
  `Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/chat/<LIBRARY_ID>" -ContentType "application/json" -Body (@{ message="Test"; answerLength="mittel"} | ConvertTo-Json -Depth 5)`
- Erwartet: 200 mit Feldern `status`, `answer` oder `results`/`sources`. Keine 500er mehr mit JSON-Parse-Fehler.
- Falls Auth nötig: Eingeloggt sein oder Header `X-User-Email` setzen.

Hinweise:
- Ich habe Tests ausgeführt; zwei bestehende `chat-config`-Tests schlagen unabhängig von dieser Änderung fehl. Sie betreffen Slug-Generierung, nicht Pinecone/Chat-Flow. Meine Änderung erzeugt keine neuen Linterfehler.
- Wenn weiterhin Fehler auftreten, poste bitte Statuscode und Response-Text der betroffenen Pinecone-Calls (query/fetch). Dann härte ich ggf. auch `embedTexts` analog ab.

Kurzfassung der Änderung
- `src/lib/chat/pinecone.ts`: Neues `parseJsonSafe`, Nutzung in `queryVectors`, `fetchVectors`, `describeIndex`. Dadurch kein `Unexpected end of JSON input` mehr bei leerem Body.

---

**User**

ich sehe viele gefundene Dokumente, aber keine Antwort

---

**Cursor**

Ich suche die Upsert-Logik, um zu prüfen, ob `metadata.text` korrekt gespeichert wird. Danach schaue ich mir das Ingest an, um zu sehen, ob alte Daten ohne Text erzeugt werden.

Ich ergänze in der Chat-Route einen Fallback: Wenn keine `sources` aus `fetchVectors` gebildet werden konnten, nutze ich die Metadaten der direkten `matches` (die bereits `includeMetadata` enthalten), um trotzdem einen Kontext und damit eine Antwort zu generieren. Danach prüfe ich Linter für die bearbeitete Datei.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'

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
    const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } })
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
      .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata }))
      .filter(r => r.meta)
      .sort((a, b) => (b.score - a.score))

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0
    for (const r of vectorRows) {
      const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
      if (!t) continue
      const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
      const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
      const score = r.score
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
      } else {
        // Als letzte Option: Nur Treffer zurückgeben (z. B. bei sehr alten Daten ohne Text)
        return NextResponse.json({
          status: 'ok',
          libraryId,
          vectorIndex: ctx.vectorIndex,
          results: matches,
        })
      }
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

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- Antworte knapp und fachlich korrekt.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`

    async function callChat(currPrompt: string) {
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
    let chatJson: any
    try {
      chatJson = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }
    const answer: string = chatJson?.choices?.[0]?.message?.content ?? ''

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



```

Kurzes Update: Ich habe zwei Punkte gehärtet, die genau dein Symptom erklären.

- Ursache 1 (fix): Pinecone-JSON-Parsing konnte leer sein → 500, und der Client zeigte dann nur Trefferliste. Ich habe robustes JSON-Parsing in `src/lib/chat/pinecone.ts` eingebaut, sodass leere Bodies nicht mehr crashen.
- Ursache 2 (fix): Wenn `fetchVectors` keine Metadaten liefert, gab die Route nur Matches zurück. Ich habe in `src/app/api/chat/[libraryId]/route.ts` einen Fallback ergänzt, der die Metadaten direkt aus den `matches` nutzt, um trotzdem `sources` und damit eine Antwort zu erzeugen.

Bitte einmal manuell testen:
- Stelle sicher, dass für die genutzte Bibliothek die Vektoren die Felder `metadata.text`, `metadata.fileName`, `metadata.chunkIndex` enthalten. Das passiert bei Upsert via `upsert-file` Route.
- Sende im UI eine Frage, die Treffer hat. Erwartet: Du siehst jetzt eine knappe Antwort und darunter Quellen. Falls Pinecone zwar Scores liefert, aber nirgendwo Text liegt, bekommst du weiterhin nur Trefferliste (letzte Ausweichoption).

Wenn du noch “Gefundene Dokumente, aber keine Antwort” siehst:
- Möglicher Grund: Alte Indizes ohne `metadata.text`. Lösung: Re-ingest via `POST /api/chat/{libraryId}/upsert-file` oder den Ingestion-Service so verwenden, dass `text` befüllt wird.
- Zweiter Check: Logge die Größe von `sources` im Server-Log. Wenn 0, sind die gespeicherten Metadaten leer oder fehlen.

Kurzfassung:
- JSON-Parsing robust gemacht.
- Fallback aus Matches-Metadaten integriert.
- Keine neuen Linterfehler. Tests laufen bis auf 2 bestehende, themenfremde `chat-config`-Tests.

---

**User**

Ich sehe keinen Unterschied, ob ich bei der Antwortlänge jetzt kurz, mittel oder ausführlich auswähle. Wie sollte sich das auswirken?
können wir die jeweils angewendeten Parameter in der console loggen?


---

**Cursor**

Ich protokolliere die verwendeten Antwortlängen-Parameter sowohl im Client (Browserkonsole) als auch serverseitig (nur mit Debug-Header oder in Nicht-Production), und prüfe danach auf Linterfehler.

```typescriptreact
"use client"

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { FileText } from 'lucide-react'

interface ChatPanelProps {
  libraryId: string
}

interface ChatConfigResponse {
  library: { id: string; label: string }
  config: {
    public: boolean
    titleAvatarSrc?: string
    welcomeMessage: string
    errorMessage?: string
    placeholder?: string
    maxChars: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    features?: { citations?: boolean; streaming?: boolean }
  }
  vectorIndex: string
}

export function ChatPanel({ libraryId }: ChatPanelProps) {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState<string>('')
  const [results, setResults] = useState<Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }>>([])
  const [answerLength, setAnswerLength] = useState<'kurz' | 'mittel' | 'ausführlich'>('mittel')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Fehler beim Laden der Chat-Konfiguration: ${res.statusText}`)
        const data = await res.json() as ChatConfigResponse
        if (!cancelled) setCfg(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId])

  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    if (cfg.config.maxChars && input.length > cfg.config.maxChars) {
      setError(cfg.config.maxCharsWarningMessage || 'Eingabe zu lang')
      return
    }
    setError(null)
    setAnswer('')
    setResults([])
    try {
      // Debug-Ausgabe: angewendete Parameter im Client
      // Hinweis: Setze den Header X-Debug auf 1, um serverseitige Logs zu aktivieren
      // (nur in Dev-Umgebungen empfohlen)
      // eslint-disable-next-line no-console
      console.log('[chat] sende Anfrage', { answerLength, chars: input.length })
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug': '1' },
        body: JSON.stringify({ message: input, answerLength })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Fehler bei der Anfrage')
      if (typeof data?.answer === 'string' && Array.isArray(data?.sources)) {
        setAnswer(data.answer)
        setResults(data.sources)
      } else if (Array.isArray(data?.results)) {
        setResults(data.results.map((r: any) => ({ id: String(r.id), score: r.score, fileName: r.metadata?.fileName, chunkIndex: r.metadata?.chunkIndex, text: r.metadata?.text })))
        setAnswer('')
      } else {
        setAnswer(typeof data.echo === 'string' ? data.echo : JSON.stringify(data))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
  }

  if (loading) return <div className="p-6">Lade Chat...</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!cfg) return <div className="p-6">Keine Konfiguration gefunden.</div>

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {cfg.config.titleAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.config.titleAvatarSrc} alt="Avatar" className="h-8 w-8 rounded" />
            ) : null}
            <span>Chat · {cfg.library.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">{cfg.config.welcomeMessage}</div>
          <Separator className="my-3" />
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>Antwortlänge:</span>
            <div className="flex gap-1">
              {(['kurz','mittel','ausführlich'] as const).map(v => (
                <Button key={v} type="button" size="sm" variant={answerLength===v? 'default':'outline'} onClick={() => setAnswerLength(v)} className="h-7">
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              ref={inputRef}
              className="flex-1"
              placeholder={cfg.config.placeholder || 'Ihre Frage...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
            />
            <Button type="button" onClick={onSend}>Senden</Button>
          </div>
          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
          {answer && (
            <div className="mt-4 p-3 rounded border bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Antwort:</div>
              <div className="whitespace-pre-wrap break-words">{answer}</div>
            </div>
          )}
          {results.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {results.map((r, i) => (
                <Tooltip key={`${r.id}-${i}`}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quelle ${i + 1}`}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[420px] p-3">
                    <div className="text-xs text-muted-foreground mb-1">Quelle {i + 1}</div>
                    <div className="text-sm font-medium break-all">{r.fileName || r.id}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {typeof r.score === 'number' && <Badge variant="secondary">Score {r.score.toFixed(3)}</Badge>}
                      {typeof r.chunkIndex === 'number' && <Badge variant="outline">Chunk {r.chunkIndex}</Badge>}
                    </div>
                    {r.text && <div className="mt-2 text-sm whitespace-pre-wrap break-words">{r.text}</div>}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          {cfg.config.footerText && (
            <div className="mt-6 text-xs text-muted-foreground">
              {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'

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
    const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } })
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
      .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata }))
      .filter(r => r.meta)
      .sort((a, b) => (b.score - a.score))

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0
    for (const r of vectorRows) {
      const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
      if (!t) continue
      const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
      const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
      const score = r.score
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
      } else {
        // Als letzte Option: Nur Treffer zurückgeben (z. B. bei sehr alten Daten ohne Text)
        return NextResponse.json({
          status: 'ok',
          libraryId,
          vectorIndex: ctx.vectorIndex,
          results: matches,
        })
      }
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

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- Antworte knapp und fachlich korrekt.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`

    async function callChat(currPrompt: string) {
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
      // eslint-disable-next-line no-console
      console.log('[api/chat] params', { answerLength, baseBudget, windowByLength, topK: baseTopK, used, sources: sources.length })
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
    let chatJson: any
    try {
      chatJson = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }
    const answer: string = chatJson?.choices?.[0]?.message?.content ?? ''

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



```

Kurzantwort:
- Wirkung Antwortlänge: Sie steuert aktuell zwei Parameter
  - Kontextfenster für Nachbarschaft: kurz=±1, mittel=±2, ausführlich=±3
  - Zeichenbudget für Quellen: kurz≈30k, mittel≈90k, ausführlich≈180k
- Ich habe Client- und Server-Logging ergänzt. Du siehst jetzt die angewendeten Parameter.

Was ist geändert:
- Client (`src/components/library/chat/chat-panel.tsx`): Loggt beim Senden die gewählte `answerLength` und Eingabelänge in der Browserkonsole. Sendet zusätzlich `X-Debug: 1`.
- Server (`src/app/api/chat/[libraryId]/route.ts`): Loggt bei `X-Debug: 1` oder in Nicht-Production:
  - answerLength
  - baseBudget (Zeichenbudget)
  - windowByLength (Nachbarschaft)
  - topK
  - used (bereits genutzte Zeichen)
  - Anzahl sources

Wie testen:
- Öffne DevTools im Browser, Tab Konsole.
- Sende dieselbe Frage mit kurz, mittel, ausführlich.
- In der Browserkonsole siehst du: `[chat] sende Anfrage { answerLength, chars }`.
- In deinem Server/Terminal siehst du: `[api/chat] params { answerLength, baseBudget, windowByLength, topK, used, sources }`.
- Erwartetes Verhalten:
  - Bei “kurz” ist `windowByLength=1`, `baseBudget≈30000`.
  - Bei “mittel” `windowByLength=2`, `baseBudget≈90000`.
  - Bei “ausführlich” `windowByLength=3`, `baseBudget≈180000`.
  - Antworten können inhaltlich ähnlich wirken, wenn die Top-Treffer bereits in den ersten Chunks liegen. Der Unterschied zeigt sich v. a. bei längeren Dokumenten oder knappen Kontextfenstern.

Hinweis:
- Falls du dennoch keinen sichtbaren Unterschied bekommst, könnte dein Datenset klein sein oder Antworten bereits durch wenige Chunks bestimmt werden. Dann wirkt die Budgeterhöhung nicht stark. Du kannst testweise Eingaben stellen, die Kontext außerhalb des ersten Treffers benötigen, um den Effekt zu sehen.

---

**User**

ich sehe keinen grossen Unterschied. sehe ich in den Logs auch, welche Dokumente verwendet wurden? und den API call an OpenAi?

---

**Cursor**

Ich ergänze jetzt detailliertere Server-Logs: ausgewählte Quellen (id, fileName, chunkIndex, score, Textlänge) und eine sanitisierte Zusammenfassung des OpenAI-Requests (Model, Temperatur, Prompt-Länge). Danach prüfe ich kurz die Linter.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'

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
    const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } })
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
      .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata }))
      .filter(r => r.meta)
      .sort((a, b) => (b.score - a.score))

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0
    for (const r of vectorRows) {
      const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
      if (!t) continue
      const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
      const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
      const score = r.score
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
      } else {
        // Als letzte Option: Nur Treffer zurückgeben (z. B. bei sehr alten Daten ohne Text)
        return NextResponse.json({
          status: 'ok',
          libraryId,
          vectorIndex: ctx.vectorIndex,
          results: matches,
        })
      }
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

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- Antworte knapp und fachlich korrekt.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`

    async function callChat(currPrompt: string) {
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
      console.log('[api/chat] params', { answerLength, baseBudget, windowByLength, topK: baseTopK, used: usedChars, sources: sources.length })
      // eslint-disable-next-line no-console
      console.log('[api/chat] sources', sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score, textChars: s.text?.length ?? 0 })))
      // eslint-disable-next-line no-console
      console.log('[api/chat] openai request', { model, temperature, promptChars: prompt.length, contextChars: context.length })
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
    let chatJson: any
    try {
      chatJson = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }
    const answer: string = chatJson?.choices?.[0]?.message?.content ?? ''

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



```

Ich passe die Funktionsdeklaration in der Chat-Route an, um den Linter-Fehler zu beheben, und prüfe erneut die Lints.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'

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
    const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } })
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
      .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata }))
      .filter(r => r.meta)
      .sort((a, b) => (b.score - a.score))

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0
    for (const r of vectorRows) {
      const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
      if (!t) continue
      const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
      const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
      const score = r.score
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
      } else {
        // Als letzte Option: Nur Treffer zurückgeben (z. B. bei sehr alten Daten ohne Text)
        return NextResponse.json({
          status: 'ok',
          libraryId,
          vectorIndex: ctx.vectorIndex,
          results: matches,
        })
      }
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

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- Antworte knapp und fachlich korrekt.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`

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
      console.log('[api/chat] params', { answerLength, baseBudget, windowByLength, topK: baseTopK, used: usedChars, sources: sources.length })
      // eslint-disable-next-line no-console
      console.log('[api/chat] sources', sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score, textChars: s.text?.length ?? 0 })))
      // eslint-disable-next-line no-console
      console.log('[api/chat] openai request', { model, temperature, promptChars: prompt.length, contextChars: context.length })
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
    let chatJson: any
    try {
      chatJson = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }
    const answer: string = chatJson?.choices?.[0]?.message?.content ?? ''

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



```

- Ja: Jetzt siehst du in den Server-Logs die verwendeten Quellen und den OpenAI-Call (sanitisiert).
  - Quellen: id, fileName, chunkIndex, score, textChars
  - OpenAI-Request: model, temperature, promptChars, contextChars
  - Parameter: answerLength, baseBudget, windowByLength, topK, used, sources

So liest du es:
- Du hast bereits Zeilen mit “[api/chat] params …” gesehen. Direkt danach kommen jetzt:
  - “[api/chat] sources …” mit der Liste der genutzten Dokumente
  - “[api/chat] openai request …” mit den Request-Metadaten
- Clientseitig loggt die Browserkonsole beim Senden: “[chat] sende Anfrage { answerLength, chars }”.

Warum du wenig Unterschied siehst:
- Wenn die Top-Treffer die Antwort bereits abdecken, bringen größere Budgets/Nachbarschaften wenig sichtbaren Zusatzgewinn. Du siehst den Effekt stärker bei längeren Dokumenten oder Fragen, die Kontext aus mehreren Nachbar-Chunks benötigen.

Wenn du mehr Differenz erzwingen willst:
- Wähle eine Frage, die Informationen benötigt, die über den ersten Chunk hinausgehen. Dann sollten “mittel/ausführlich” mehr Quellen in “sources” zeigen, und prompt/contextChars steigen.

---

**User**

Und sollte je nach erwarteter Größe unterschiedlich formuliert sein. Entweder ausführlich, knapp oder mittel lang.

---

**Cursor**

Ich passe den Prompt in der Chat-Route an, sodass er je nach `answerLength` (kurz/mittel/ausführlich) unterschiedliche Stilvorgaben enthält, und logge die angewendete Stilregel im Debug-Log. Danach prüfe ich Linter-Warnungen.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'

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
    const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, { user: { $eq: userEmail || '' }, libraryId: { $eq: libraryId } })
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
      .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata }))
      .filter(r => r.meta)
      .sort((a, b) => (b.score - a.score))

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0
    for (const r of vectorRows) {
      const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
      if (!t) continue
      const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
      const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
      const score = r.score
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
      } else {
        // Als letzte Option: Nur Treffer zurückgeben (z. B. bei sehr alten Daten ohne Text)
        return NextResponse.json({
          status: 'ok',
          libraryId,
          vectorIndex: ctx.vectorIndex,
          results: matches,
        })
      }
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
      console.log('[api/chat] params', { answerLength, baseBudget, windowByLength, topK: baseTopK, used: usedChars, sources: sources.length })
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
    let chatJson: any
    try {
      chatJson = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }
    const answer: string = chatJson?.choices?.[0]?.message?.content ?? ''

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



```

- Ich habe die Prompt-Stilvorgaben je nach Antwortlänge umgesetzt:
  - kurz: 1–3 Sätze, max. ~120 Wörter, direkt auf den Punkt
  - mittel: ~120–250 Wörter, 3–6 Sätze oder kurze Liste
  - ausführlich: ~250–600 Wörter, mit kurzer Zusammenfassung und strukturierten Absätzen

- Im Debug-Log siehst du zusätzlich das Feld style: kurz/mittel/ausführlich.

Teste bitte nochmal mit allen drei Varianten; die Formulierung sollte sich nun klar unterscheiden.

