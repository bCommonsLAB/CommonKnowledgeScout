import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getQueryLogById } from '@/lib/db/queries-repo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  try {
    const { libraryId, queryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const log = await getQueryLogById({ libraryId, queryId, userEmail })
    if (!log) return NextResponse.json({ error: 'Log nicht gefunden' }, { status: 404 })

    const chatApiKey = process.env.OPENAI_API_KEY
    if (!chatApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })
    const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
    const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.2)

    // Sanitisierte, kompakte Ansicht für das LLM
    const compact = {
      queryId: log.queryId,
      question: log.question,
      mode: log.mode,
      facetsSelected: log.facetsSelected,
      filters: { normalized: log.filtersNormalized, pinecone: log.filtersPinecone },
      retrieval: (log.retrieval || []).map(s => ({
        stage: s.stage,
        level: s.level,
        topKRequested: s.topKRequested,
        topKReturned: s.topKReturned,
        timingMs: s.timingMs,
      })),
      sources: (log.sources || []).slice(0, 30),
      timing: log.timing,
      createdAt: log.createdAt,
    }

    const system = 'Du bist ein Assistent, der komplexe technische Abläufe laienverständlich erklärt.'
    const userMsg = `Erkläre diese Logdatei einer RAG-Query verständlich in 4-8 kurzen Sätzen. Keine Angaben über Benutzer und dass es sich um eine Logdatei handelt. Einfach erklären, wie die Antwort zustandekommt.
Hintergrundinformationen:    
1) Chunk-Retriever (klassischer RAG)
wenn mode="chunks"
Schritte:
1. Frage-Embedding berechnen.
2. Vektor-Query auf Chunks mit Filtern (Top-K).
3. Optional: Parallel Kapitel-Summary-Query (Top-K) → Kapitel-Boost-Map aufbauen.
4. Nachbarfenster für Top-Treffer bestimmen (±w) und vollständige Metadaten laden.
5. Scoring-Phase: Kapitel-Boost und leichter lexikalischer Boost anwenden; Sortierung.
6. Budgetakkumulation: Snippets in Reihenfolge einfügen bis Budget erreicht.
7. Logging: embed → query(chunks) → query(summary, optional) → fetchNeighbors → KPIs.

2. Summary-Retriever (Kapitel-Summaries als Gesamt-Kontext)
wenn mode="summaries"

Schritte:
1. Vektoren listen (oder gefiltert selektieren) und clientseitig nach kind=chapterSummary + Filter einschränken.
2. Zu den gefundenen Kapiteln ergänzende Metadaten aus doc-meta-repo laden (Titel, ShortTitle, Summary-Felder).
3. Kurz-Text für jedes Kapitel komponieren (Kapitel-Header, Summary-Content, ggf. Fallbacks).
4. Budgetakkumulation: Summaries der Reihe nach, bis Zeichenziel erreicht.
5. Logging: list(summary) → KPIs.

Schwerpunkt:
Erkläre welche Schritte, welche Daten/Quellen verwendet wurden, wie entstand die Antwort.
Vermeide Fachjargon, aber nenne wichtige Begriffe (Retriever, Top-K, Quellen) präzise.
Sprache: Deutsch.

LOG (JSON):\n${JSON.stringify(compact, null, 2)}`

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
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `OpenAI Fehler: ${res.status}`, details: text.slice(0, 500) }, { status: 502 })
    }
    const raw = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const explanation = raw?.choices?.[0]?.message?.content || ''
    return NextResponse.json({ queryId, explanation })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] explain error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    })
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}


