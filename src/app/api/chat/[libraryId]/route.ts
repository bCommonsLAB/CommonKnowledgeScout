import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { startQueryLog, failQueryLog, setQuestionAnalysis } from '@/lib/logging/query-logger'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { buildFilters } from '@/lib/chat/common/filters'
import { analyzeQuestionForRetriever } from '@/lib/chat/common/question-analyzer'
import type { NeedsClarificationResponse } from '@/types/chat-response'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  answerLength: z.enum(['kurz','mittel','ausführlich','unbegrenzt']).default('mittel'),
  chatHistory: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
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

    const { message, answerLength, chatHistory } = body.data

    // Optional: Filter aus Query (Facetten im Chat-Kontext wiederverwenden)
    const parsedUrl = new URL(request.url)
    
    // Query-Logging initialisieren (muss vor allen logAppend-Aufrufen stehen)
    const facetsSelected: Record<string, unknown> = {}
    parsedUrl.searchParams.forEach((v, k) => {
      if (!facetsSelected[k]) facetsSelected[k] = [] as unknown[]
      ;(facetsSelected[k] as unknown[]).push(v)
    })

    // Intelligente Retriever-Analyse (nur wenn nicht explizit überschrieben)
    const retrieverParamRaw = (parsedUrl.searchParams.get('retriever') || '').toLowerCase()
    const autoRetrieverEnabled = parsedUrl.searchParams.get('autoRetriever') !== 'false'
    const explicitRetriever = retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc' || retrieverParamRaw === 'chunk'
    
    let analyzedRetriever: 'chunk' | 'summary' | null = null
    let questionAnalysis: Awaited<ReturnType<typeof analyzeQuestionForRetriever>> | undefined = undefined
    
    // Analyse durchführen, wenn nicht explizit überschrieben
    if (!explicitRetriever && autoRetrieverEnabled && process.env.ENABLE_AUTO_RETRIEVER_ANALYSIS !== 'false') {
      try {
        const isEventMode = ctx.chat.gallery.detailViewType === 'session'
        questionAnalysis = await analyzeQuestionForRetriever(message, {
          isEventMode,
          libraryType: ctx.library.type,
        })
        
        // Wenn Analyse 'unclear' empfiehlt, return NeedsClarificationResponse
        if (questionAnalysis.recommendation === 'unclear') {
          const clarificationResponse: NeedsClarificationResponse = {
            status: 'needs_clarification',
            analysis: {
              explanation: questionAnalysis.explanation,
              suggestedQuestions: {
                chunk: questionAnalysis.suggestedQuestionChunk,
                summary: questionAnalysis.suggestedQuestionSummary,
              },
            },
          }
          return NextResponse.json(clarificationResponse)
        }
        
        // Setze empfohlenen Retriever
        analyzedRetriever = questionAnalysis.recommendation === 'summary' ? 'summary' : 'chunk'
      } catch (error) {
        // Bei Fehler der Analyse: Fallback auf Standard-Verhalten (chunk)
        console.error('[api/chat] Frage-Analyse fehlgeschlagen:', error)
        analyzedRetriever = null
      }
    }
    
    // Retriever bestimmen: Explizit gesetzt > Analyse > Standard (chunk)
    const effectiveRetriever: 'chunk' | 'summary' = explicitRetriever 
      ? (retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc' ? 'summary' : 'chunk')
      : (analyzedRetriever ?? 'chunk')

    // Bestimme effektive Chat-Config: Query-Parameter überschreiben Config-Werte
    const targetLanguageParam = parsedUrl.searchParams.get('targetLanguage')
    const characterParam = parsedUrl.searchParams.get('character')
    const socialContextParam = parsedUrl.searchParams.get('socialContext')
    
    const effectiveChatConfig = {
      ...ctx.chat,
      targetLanguage: (targetLanguageParam && ['de', 'en', 'it', 'fr', 'es', 'ar'].includes(targetLanguageParam)) 
        ? targetLanguageParam as 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar'
        : ctx.chat.targetLanguage,
      character: (characterParam && ['developer', 'business', 'eco-social', 'social', 'open-source', 'legal', 'scientific'].includes(characterParam))
        ? characterParam as 'developer' | 'business' | 'eco-social' | 'social' | 'open-source' | 'legal' | 'scientific'
        : ctx.chat.character,
      socialContext: (socialContextParam && ['scientific', 'popular', 'youth', 'senior'].includes(socialContextParam))
        ? socialContextParam as 'scientific' | 'popular' | 'youth' | 'senior'
        : ctx.chat.socialContext,
    }

    // Neuer Pfad: Summary-Retriever über Mongo (retriever=summary oder von Analyse empfohlen)
    if (effectiveRetriever === 'summary') {
      const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, 'summary')
      const modeNow = 'summaries' as const
      const queryId = await startQueryLog({
        libraryId,
        userEmail: emailForLoad,
        question: message,
        mode: modeNow,
        answerLength,
        retriever: 'summary',
        facetsSelected,
        filtersNormalized: { ...built.normalized },
        filtersPinecone: { ...built.pinecone },
      })
      
      // Analyse-Ergebnisse speichern, falls vorhanden
      if (questionAnalysis) {
        await setQuestionAnalysis(queryId, {
          recommendation: questionAnalysis.recommendation,
          confidence: questionAnalysis.confidence,
          reasoning: questionAnalysis.reasoning,
        })
      }
      const { answer, sources, references, suggestedQuestions } = await runChatOrchestrated({
        retriever: 'summary',
        libraryId,
        userEmail: emailForLoad,
        question: message,
        answerLength,
        filters: built.mongo,
        queryId,
        context: { vectorIndex: ctx.vectorIndex },
        chatConfig: effectiveChatConfig,
        chatHistory: chatHistory,
      })
      return NextResponse.json({
        status: 'ok',
        libraryId,
        vectorIndex: ctx.vectorIndex,
        answer,
        references,
        suggestedQuestions,
        sources, // Behalte sources für Rückwärtskompatibilität
        queryId,
      })
    }
    
    // Chunk-Flow (Standard oder wenn von Analyse empfohlen)
    // Verwende den Orchestrator für einheitliche Verarbeitung
    const mode: 'summaries' | 'chunks' = 'chunks'
    const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, 'chunk')
    const queryId = await startQueryLog({
      libraryId,
      userEmail: emailForLoad,
      question: message,
      mode,
      answerLength,
      retriever: 'chunk' as const,
      facetsSelected,
      filtersNormalized: { ...built.normalized },
      filtersPinecone: { ...built.pinecone },
    })
    
    // Analyse-Ergebnisse speichern, falls vorhanden
    if (questionAnalysis) {
      await setQuestionAnalysis(queryId, {
        recommendation: questionAnalysis.recommendation,
        confidence: questionAnalysis.confidence,
        reasoning: questionAnalysis.reasoning,
      })
    }

    // Verwende Orchestrator für einheitliche Verarbeitung (wie Summary-Flow)
    const { answer, sources, references, suggestedQuestions } = await runChatOrchestrated({
      retriever: 'chunk',
      libraryId,
      userEmail: emailForLoad,
      question: message,
      answerLength,
      filters: built.mongo,
      queryId,
      context: { vectorIndex: ctx.vectorIndex },
      chatConfig: effectiveChatConfig,
      chatHistory: chatHistory,
    })
    
    return NextResponse.json({
      status: 'ok',
      libraryId,
      vectorIndex: ctx.vectorIndex,
      answer,
      references,
      suggestedQuestions,
      sources, // Behalte sources für Rückwärtskompatibilität
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
