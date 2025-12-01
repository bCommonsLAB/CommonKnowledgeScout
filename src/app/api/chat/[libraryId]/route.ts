import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { startQueryLog, failQueryLog, setQuestionAnalysis } from '@/lib/logging/query-logger'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { buildFilters } from '@/lib/chat/common/filters'
import { analyzeQuestionForRetriever } from '@/lib/chat/common/question-analyzer'
import { createChat, touchChat, getChatById } from '@/lib/db/chats-repo'
import {
  ANSWER_LENGTH_ZOD_ENUM,
  isValidTargetLanguage,
  isValidSocialContext,
  normalizeCharacterToArray,
  normalizeAccessPerspectiveToArray,
  parseCharacterFromUrlParam,
  parseAccessPerspectiveFromUrlParam,
} from '@/lib/chat/constants'
import type { NeedsClarificationResponse } from '@/types/chat-response'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  answerLength: ANSWER_LENGTH_ZOD_ENUM.default('mittel'),
  chatHistory: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  chatId: z.string().optional(), // Optional: chatId für bestehenden Chat oder null für neuen Chat
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

    // Wenn keine Email vorhanden ist und nicht öffentlich, Fehler zurückgeben
    if (!userEmail) {
      // Prüfe erst, ob Chat öffentlich ist, bevor wir ablehnen
      const ctx = await loadLibraryChatContext('', libraryId)
      if (!ctx || !ctx.library.config?.publicPublishing?.isPublic) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      }
      // Wenn öffentlich, können wir ohne Email fortfahren
    }

    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Body validieren
    const json = await request.json().catch(() => ({}))
    const body = chatRequestSchema.safeParse(json)
    if (!body.success) {
      return NextResponse.json({ error: 'Ungültige Anfrage', details: body.error.flatten() }, { status: 400 })
    }

    const { message, answerLength, chatHistory, chatId: bodyChatId } = body.data

    // Optional: Filter aus Query (Facetten im Chat-Kontext wiederverwenden)
    const parsedUrl = new URL(request.url)
    // chatId kann aus Query-Parameter oder Body kommen
    const chatIdParam = parsedUrl.searchParams.get('chatId')
    const chatId = bodyChatId || chatIdParam || null
    
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
    
    // Chat-Verwaltung: Wenn keine chatId vorhanden, erstelle neuen Chat
    let activeChatId: string
    if (!chatId) {
      // Neuen Chat erstellen mit generiertem Titel aus Frage-Analyse
      const chatTitle = questionAnalysis?.chatTitle || message.slice(0, 60)
      activeChatId = await createChat(libraryId, userEmail || '', chatTitle)
    } else {
      // Bestehenden Chat verwenden und updatedAt aktualisieren
      activeChatId = chatId
      // Prüfe, ob Chat existiert und Benutzer Zugriff hat
      const existingChat = await getChatById(chatId, userEmail || '')
      if (!existingChat) {
        return NextResponse.json({ error: 'Chat nicht gefunden' }, { status: 404 })
      }
      // Aktualisiere updatedAt
      await touchChat(chatId)
    }
    
    // Retriever bestimmen: Explizit gesetzt > Analyse > Standard (chunk)
    const effectiveRetriever: 'chunk' | 'summary' = explicitRetriever 
      ? (retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc' ? 'summary' : 'chunk')
      : (analyzedRetriever ?? 'chunk')

    // Bestimme effektive Chat-Config: Query-Parameter überschreiben Config-Werte
    const targetLanguageParam = parsedUrl.searchParams.get('targetLanguage')
    const characterParam = parsedUrl.searchParams.get('character')
    const accessPerspectiveParam = parsedUrl.searchParams.get('accessPerspective')
    const socialContextParam = parsedUrl.searchParams.get('socialContext')
    const genderInclusiveParam = parsedUrl.searchParams.get('genderInclusive')
    
    // Parse character Parameter aus URL (komma-separierter String → Character[] Array)
    const effectiveCharacter = parseCharacterFromUrlParam(characterParam)
    // Parse accessPerspective Parameter aus URL (komma-separierter String → AccessPerspective[] Array)
    const effectiveAccessPerspective = parseAccessPerspectiveFromUrlParam(accessPerspectiveParam)
    
    const effectiveChatConfig = {
      ...ctx.chat,
      targetLanguage: isValidTargetLanguage(targetLanguageParam)
        ? targetLanguageParam
        : ctx.chat.targetLanguage,
      character: effectiveCharacter ?? normalizeCharacterToArray(ctx.chat.character),
      accessPerspective: effectiveAccessPerspective ?? normalizeAccessPerspectiveToArray(ctx.chat.accessPerspective),
      socialContext: isValidSocialContext(socialContextParam)
        ? socialContextParam
        : ctx.chat.socialContext,
      genderInclusive: genderInclusiveParam === 'true' 
        ? true 
        : genderInclusiveParam === 'false' 
        ? false 
        : ctx.chat.genderInclusive,
    }

    // Neuer Pfad: Summary-Retriever über Mongo (retriever=summary oder von Analyse empfohlen)
    if (effectiveRetriever === 'summary') {
      const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, 'summary')
      const modeNow = 'summaries' as const
      const queryId = await startQueryLog({
        libraryId,
        chatId: activeChatId,
        userEmail: userEmail || '',
        question: message,
        mode: modeNow,
        answerLength,
        retriever: 'summary',
        targetLanguage: effectiveChatConfig.targetLanguage,
        character: effectiveChatConfig.character, // Array (kann leer sein)
        accessPerspective: effectiveChatConfig.accessPerspective, // Array (kann leer sein)
        socialContext: effectiveChatConfig.socialContext,
        genderInclusive: effectiveChatConfig.genderInclusive,
        facetsSelected,
        filtersNormalized: { ...built.normalized },
      })
      
      // Analyse-Ergebnisse speichern, falls vorhanden
      if (questionAnalysis) {
        await setQuestionAnalysis(queryId, {
          recommendation: questionAnalysis.recommendation,
          confidence: questionAnalysis.confidence,
          reasoning: questionAnalysis.reasoning,
        })
      }
      // Verwende publicApiKey wenn vorhanden (für öffentliche Libraries)
      const publicApiKey = ctx.library.config?.publicPublishing?.apiKey
      const { answer, sources, references, suggestedQuestions } = await runChatOrchestrated({
        retriever: 'summary',
        libraryId,
        userEmail: userEmail || '',
        question: message,
        answerLength,
        filters: built.mongo,
        queryId,
        context: {},
        chatConfig: effectiveChatConfig,
        chatHistory: chatHistory,
        apiKey: publicApiKey,
      })
      return NextResponse.json({
        status: 'ok',
        libraryId,
        answer,
        references,
        suggestedQuestions,
        sources, // Behalte sources für Rückwärtskompatibilität
        queryId,
        chatId: activeChatId, // Chat-ID zurückgeben
      })
    }
    
    // Chunk-Flow (Standard oder wenn von Analyse empfohlen)
    // Verwende den Orchestrator für einheitliche Verarbeitung
    const mode: 'summaries' | 'chunks' = 'chunks'
    const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, 'chunk')
    const queryId = await startQueryLog({
      libraryId,
      chatId: activeChatId,
      userEmail: userEmail || '',
      question: message,
      mode,
      answerLength,
      retriever: 'chunk' as const,
      targetLanguage: effectiveChatConfig.targetLanguage,
      character: effectiveChatConfig.character, // Array (kann leer sein)
      accessPerspective: effectiveChatConfig.accessPerspective, // Array (kann leer sein)
      socialContext: effectiveChatConfig.socialContext,
      facetsSelected,
      filtersNormalized: { ...built.normalized },
    })
    
    // Analyse-Ergebnisse speichern, falls vorhanden
    if (questionAnalysis) {
      await setQuestionAnalysis(queryId, {
        recommendation: questionAnalysis.recommendation,
        confidence: questionAnalysis.confidence,
        reasoning: questionAnalysis.reasoning,
      })
    }

    // Verwende Library-spezifischen API-Key, falls vorhanden
    const libraryApiKey = ctx.library.config?.publicPublishing?.apiKey
    // Verwende Orchestrator für einheitliche Verarbeitung (wie Summary-Flow)
    const { answer, sources, references, suggestedQuestions } = await runChatOrchestrated({
      retriever: 'chunk',
      libraryId,
      userEmail: userEmail || '',
      context: {},
      question: message,
      answerLength,
      filters: built.mongo,
      queryId,
      chatConfig: effectiveChatConfig,
      chatHistory: chatHistory,
      apiKey: libraryApiKey,
    })
    
    return NextResponse.json({
      status: 'ok',
      libraryId,
      answer,
      references,
      suggestedQuestions,
      sources, // Behalte sources für Rückwärtskompatibilität
      queryId,
      chatId: activeChatId, // Chat-ID zurückgeben
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
