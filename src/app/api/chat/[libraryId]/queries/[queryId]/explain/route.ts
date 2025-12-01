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
    const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4.1-mini'
    const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.2)

    // Sanitisierte, kompakte Ansicht für das LLM
    const compact = {
      queryId: log.queryId,
      question: log.question,
      mode: log.mode,
      retriever: log.retriever,
      questionAnalysis: log.questionAnalysis ? {
        recommendation: log.questionAnalysis.recommendation,
        confidence: log.questionAnalysis.confidence,
        reasoning: log.questionAnalysis.reasoning,
      } : undefined,
      facetsSelected: log.facetsSelected,
      filters: { normalized: log.filtersNormalized },
      retrieval: (log.retrieval || []).map(s => ({
        stage: s.stage,
        level: s.level,
        topKRequested: s.topKRequested,
        topKReturned: s.topKReturned,
        timingMs: s.timingMs,
        decision: s.decision,
        candidatesCount: s.candidatesCount,
        usedInPrompt: s.usedInPrompt,
      })),
      sources: (log.sources || []).slice(0, 30),
      timing: log.timing,
      createdAt: log.createdAt,
    }

    const system = 'Du bist ein Assistent, der komplexe technische Abläufe laienverständlich erklärt.'
    
    // Bestimme welcher Modus verwendet wurde
    const usedMode = log.mode === 'summaries' || log.retriever === 'summary' || log.retriever === 'doc' ? 'summary' : 'chunk'
    
    // Erweitere Erklärung um Analyse-Informationen
    let analysisContext = ''
    if (log.questionAnalysis) {
      const analysis = log.questionAnalysis
      const recommendedLabel = analysis.recommendation === 'chunk' ? 'Chunk-Modus (spezifische Detailsuche)' : analysis.recommendation === 'summary' ? 'Summary-Modus (Überblick-Suche)' : 'Unklar (Frage zu vage)'
      const usedLabel = usedMode === 'chunk' ? 'Chunk-Modus' : 'Summary-Modus'
      const confidenceLabel = analysis.confidence === 'high' ? 'hoch' : analysis.confidence === 'medium' ? 'mittel' : 'niedrig'
      
      analysisContext = `\n\nWICHTIG: Retriever-Analyse wurde durchgeführt:
- Empfehlung: ${recommendedLabel} (Konfidenz: ${confidenceLabel})
- Begründung der Empfehlung: ${analysis.reasoning}
- Tatsächlich verwendet: ${usedLabel}
${analysis.recommendation === usedMode || (analysis.recommendation === 'summary' && (log.retriever === 'doc' || log.retriever === 'summary')) ? '- Die Empfehlung wurde befolgt.' : '- Die Empfehlung wurde überschrieben (expliziter Parameter oder Fallback).'}
`
    }
    
    // Unterschiedliche Erklärungen je nach verwendetem Modus
    const chunkFlow = `**Chunk-Retriever-Flow** (wenn mode="chunks" oder retriever="chunk"):
1. Frage-Embedding berechnen: Die Frage wird in eine Zahlenform (Vektor) umgewandelt
2. Vektor-Query auf Chunks: Suche nach ähnlichen Textausschnitten mit semantischer Ähnlichkeit (Top-K Ergebnisse)
3. Optional: Parallel Kapitel-Summary-Query: Lädt Kapitel-Übersichten für besseren Kontext
4. Nachbarfenster: Lädt Textstellen um die Treffer herum für mehr Zusammenhang
5. Scoring: Bewertet und sortiert die Treffer nach Relevanz
6. Budgetakkumulation: Wählt Quellen aus bis Zeichen-Budget erreicht ist
7. LLM: Generiert Antwort basierend auf den ausgewählten Quellen`

    const summaryFlow = `**Summary-Retriever-Flow** (wenn mode="summaries" oder retriever="summary"):
1. Dokument-Auflistung: Lädt alle verfügbaren Dokumente/Kapitel aus MongoDB (kein Ranking)
2. Filterung: Wendet Filter an (z.B. Event, Jahr, Tags)
3. Metadaten-Laden: Ergänzt Dokument-Infos (Titel, Summary) aus der Datenbank
4. Budgetakkumulation: Wählt Dokumente/Kapitel der Reihe nach bis Budget erreicht ist
5. LLM: Generiert Antwort basierend auf den Dokument-Zusammenfassungen`

    const userMsg = `Erkläre diese Query-Logdatei verständlich in 5-10 kurzen Sätzen. 

WICHTIG: 
- Erkenne zuerst, welcher Modus verwendet wurde (mode und retriever im JSON zeigen das)
- Erkläre dann die entsprechenden Schritte für diesen Modus
- ${analysisContext ? 'Erkläre auch die automatische Retriever-Auswahl und warum dieser Modus gewählt wurde.' : ''}
- Keine Angaben über Benutzer oder dass es eine Logdatei ist
- Erkläre einfach, wie die Antwort zustandekommt

Verfügbare Modi:

${chunkFlow}

${summaryFlow}

Aktuelle Query:
- mode: ${log.mode}
- retriever: ${log.retriever || 'nicht gesetzt'}
- verwendeter Modus: ${usedMode === 'chunk' ? 'Chunk-Retriever' : 'Summary-Retriever'}
${analysisContext}
${log.retrieval && log.retrieval.length > 0 ? `\nRetrieval-Schritte:\n${log.retrieval.map((s, i) => `${i + 1}. ${s.stage} [${s.level}] - ${s.timingMs}ms - ${s.topKReturned || 0} Ergebnisse`).join('\n')}` : ''}
${log.sources && log.sources.length > 0 ? `\nVerwendete Quellen: ${log.sources.length} Quellen wurden für die Antwort verwendet.` : ''}

Vollständige Log-Daten:
${JSON.stringify(compact, null, 2)}`

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


