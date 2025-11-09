/**
 * @fileoverview Chat Streaming API Route - Server-Sent Events Endpoint for Chat
 * 
 * @description
 * POST endpoint for chat streaming using Server-Sent Events (SSE). Handles authentication,
 * question analysis, retriever selection, chat orchestration, and streaming response generation.
 * Supports both authenticated users and anonymous users (for public libraries). Manages chat
 * creation, query logging, and error handling.
 * 
 * @module chat
 * 
 * @exports
 * - POST: Chat streaming endpoint handler
 * 
 * @usedIn
 * - Next.js framework: Route handler for /api/chat/[libraryId]/stream
 * - src/components/library/chat: Chat components call this endpoint
 * 
 * @dependencies
 * - @clerk/nextjs/server: Authentication utilities
 * - @/lib/chat/loader: Library chat context loading
 * - @/lib/chat/orchestrator: Chat orchestration
 * - @/lib/chat/common/question-analyzer: Question analysis
 * - @/lib/db/chats-repo: Chat repository
 * - @/lib/logging/query-logger: Query logging
 */

import { NextRequest } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { startQueryLog, setQuestionAnalysis } from '@/lib/logging/query-logger'
import { updateQueryLogPartial } from '@/lib/db/queries-repo'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { buildFilters } from '@/lib/chat/common/filters'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { analyzeQuestionForRetriever } from '@/lib/chat/common/question-analyzer'
import { createChat, touchChat, getChatById } from '@/lib/db/chats-repo'
import {
  ANSWER_LENGTH_ZOD_ENUM,
  isValidTargetLanguage,
  isValidCharacter,
  isValidSocialContext,
} from '@/lib/chat/constants'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { formatSSE } from '@/types/chat-processing'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  answerLength: ANSWER_LENGTH_ZOD_ENUM.default('mittel'),
  chatHistory: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  chatId: z.string().optional(),
})

/**
 * SSE-Streaming-Endpoint für Chat-Verarbeitung mit Status-Updates
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  const { libraryId } = await params

  // Erstelle einen ReadableStream für SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Sammle alle Processing-Steps für persistierung
      const collectedSteps: ChatProcessingStep[] = []
      
      // queryId wird später gesetzt, muss aber im catch-Block verfügbar sein
      let queryId: string | undefined = undefined
      
      function send(status: ChatProcessingStep) {
        // Sammle alle Steps (außer complete und error, die werden separat behandelt)
        if (status.type !== 'complete' && status.type !== 'error') {
          collectedSteps.push(status)
        }
        controller.enqueue(encoder.encode(formatSSE(status)))
      }

      try {
        // Auth prüfen
        const { userId } = await auth()
        const user = await currentUser()
        const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

        // Session-ID aus Header lesen (für anonyme Nutzer)
        const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
        const sessionId = sessionIdHeader || undefined

        // Library-Context laden (unterstützt auch öffentliche Libraries ohne Email)
        const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
        if (!ctx) {
          send({ type: 'error', error: 'Bibliothek nicht gefunden' })
          controller.close()
          return
        }

        // Zugriff: wenn nicht public, Auth erforderlich
        if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
          send({ type: 'error', error: 'Nicht authentifiziert' })
          controller.close()
          return
        }

        // Für anonyme Nutzer: Session-ID muss vorhanden sein
        if (!userEmail && !sessionId) {
          send({ type: 'error', error: 'Session-ID erforderlich für anonyme Nutzer' })
          controller.close()
          return
        }

        // Body validieren
        const json = await request.json().catch(() => ({}))
        const body = chatRequestSchema.safeParse(json)
        if (!body.success) {
          send({ type: 'error', error: 'Ungültige Anfrage' })
          controller.close()
          return
        }

        const { message, answerLength, chatHistory, chatId: bodyChatId } = body.data

        // Query-Parameter parsen
        const parsedUrl = new URL(request.url)
        const chatIdParam = parsedUrl.searchParams.get('chatId')
        const chatId = bodyChatId || chatIdParam || null

        // Extrahiere nur Facetten-Filter (nicht Chat-Konfiguration)
        const facetDefs = parseFacetDefs(ctx.library)
        const facetsSelected: Record<string, unknown> = {}
        const facetMetaKeys = new Set(facetDefs.map(d => d.metaKey))
        
        // Nur Parameter, die tatsächlich Facetten sind
        parsedUrl.searchParams.forEach((v, k) => {
          // Überspringe Chat-Konfigurations-Parameter
          if (['retriever', 'targetLanguage', 'character', 'socialContext', 'genderInclusive', 'chatId'].includes(k)) {
            return
          }
          // Nur Facetten-Parameter übernehmen
          if (facetMetaKeys.has(k)) {
          if (!facetsSelected[k]) facetsSelected[k] = [] as unknown[]
          ;(facetsSelected[k] as unknown[]).push(v)
          }
        })

        // Schritt 1: Frage-Analyse
        // Prüfe ZUERST, ob es eine TOC-Query ist, bevor wir Steps senden
        const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
        const isTOCQuery = message.trim() === tocQuestion.trim()
        
        // Nur für normale Fragen: Frage-Analyse starten
        if (!isTOCQuery) {
          send({ type: 'question_analysis_start', question: message })
        }
        
        const retrieverParamRaw = (parsedUrl.searchParams.get('retriever') || '').toLowerCase()
        const autoRetrieverEnabled = parsedUrl.searchParams.get('autoRetriever') !== 'false'
        const explicitRetriever = retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc' || retrieverParamRaw === 'chunk'
        
        let analyzedRetriever: 'chunk' | 'summary' | null = null
        // Schritt 1: Frage-Analyse (nur für normale Fragen, nicht für TOC-Queries)
        
        // Verwende Library-spezifischen API-Key, falls vorhanden
        const libraryApiKey = ctx.library.config?.publicPublishing?.apiKey
        
        let questionAnalysis: Awaited<ReturnType<typeof analyzeQuestionForRetriever>> | undefined = undefined
        
        // Für TOC-Queries: Überspringe Frage-Analyse, verwende immer Summary-Modus
        if (!isTOCQuery && !explicitRetriever && autoRetrieverEnabled && process.env.ENABLE_AUTO_RETRIEVER_ANALYSIS !== 'false') {
          try {
            const isEventMode = ctx.chat.gallery.detailViewType === 'session'
            questionAnalysis = await analyzeQuestionForRetriever(message, {
              isEventMode,
              libraryType: ctx.library.type,
            }, libraryApiKey)
            
            send({
              type: 'question_analysis_result',
              recommendation: questionAnalysis.recommendation,
              confidence: questionAnalysis.confidence,
              chatTitle: questionAnalysis.chatTitle,
            })
            
            if (questionAnalysis.recommendation === 'unclear') {
              // Für clarification müssen wir die Frage-Analyse-Daten zurückgeben
              // Aber das Frontend erwartet eine normale Response-Struktur
              // Wir senden einen error-step mit clarification-Info, den das Frontend erkennen kann
              // Oder besser: Wir senden einen speziellen complete-step mit clarification-Flag
              const clarificationStep: ChatProcessingStep & { clarification?: { explanation: string; suggestedQuestions: { chunk?: string; summary?: string } } } = {
                type: 'complete',
                answer: `**${questionAnalysis.explanation}**\n\n**Vorgeschlagene präzisierte Fragen:**`,
                references: [],
                suggestedQuestions: [
                  questionAnalysis.suggestedQuestionChunk,
                  questionAnalysis.suggestedQuestionSummary,
                ].filter((q): q is string => typeof q === 'string' && q.length > 0),
                queryId: '',
                chatId: '',
                clarification: {
                  explanation: questionAnalysis.explanation,
                  suggestedQuestions: {
                    chunk: questionAnalysis.suggestedQuestionChunk,
                    summary: questionAnalysis.suggestedQuestionSummary,
                  },
                },
              }
              
              // Bei clarification gibt es keine queryId, daher keine Logs speichern
              collectedSteps.push(clarificationStep)
              send(clarificationStep)
              controller.close()
              return
            }
            
            analyzedRetriever = questionAnalysis.recommendation === 'summary' ? 'summary' : 'chunk'
          } catch (error) {
            console.error('[api/chat/stream] Frage-Analyse fehlgeschlagen:', error)
            // Nur für normale Queries: Frage-Analyse-Ergebnis senden
            if (!isTOCQuery) {
              send({ type: 'question_analysis_result', recommendation: 'chunk', confidence: 'low' })
            }
          }
        } else {
          // Nur für normale Queries: Frage-Analyse-Ergebnis senden
          if (!isTOCQuery) {
            send({ type: 'question_analysis_result', recommendation: explicitRetriever ? (retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc' ? 'summary' : 'chunk') : 'chunk', confidence: 'high' })
          }
        }

        // Schritt 2: Chat-Verwaltung
        let activeChatId: string
        if (!chatId) {
          const chatTitle = questionAnalysis?.chatTitle || message.slice(0, 60)
          // Verwende userEmail oder sessionId für Chat-Erstellung
          activeChatId = await createChat(libraryId, userEmail || sessionId || '', chatTitle)
        } else {
          activeChatId = chatId
          const existingChat = await getChatById(chatId, userEmail || sessionId || '')
          if (!existingChat) {
            send({ type: 'error', error: 'Chat nicht gefunden' })
            controller.close()
            return
          }
          await touchChat(chatId)
        }

        // Schritt 3: Retriever bestimmen
        // Für TOC-Queries: Immer Summary-Modus verwenden
        const effectiveRetriever: 'chunk' | 'summary' = isTOCQuery
          ? 'summary'
          : explicitRetriever 
          ? (retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc' ? 'summary' : 'chunk')
          : (analyzedRetriever ?? 'chunk')

        send({
          type: 'retriever_selected',
          retriever: effectiveRetriever,
          reason: isTOCQuery 
            ? 'TOC-Query: Immer Summary-Modus'
            : explicitRetriever 
            ? 'Explizit gesetzt' 
            : questionAnalysis 
            ? `Von Analyse empfohlen (${questionAnalysis.confidence})` 
            : 'Standard',
        })

        // Chat-Config bestimmen
        const targetLanguageParam = parsedUrl.searchParams.get('targetLanguage')
        const characterParam = parsedUrl.searchParams.get('character')
        const socialContextParam = parsedUrl.searchParams.get('socialContext')
        
        const effectiveChatConfig = {
          ...ctx.chat,
          targetLanguage: isValidTargetLanguage(targetLanguageParam)
            ? targetLanguageParam
            : ctx.chat.targetLanguage,
          character: isValidCharacter(characterParam)
            ? characterParam
            : ctx.chat.character,
          socialContext: isValidSocialContext(socialContextParam)
            ? socialContextParam
            : ctx.chat.socialContext,
        }

        // Schritt 4: Filter aufbauen
        const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, effectiveRetriever)
        const modeNow = effectiveRetriever === 'summary' ? 'summaries' as const : 'chunks' as const

        // Schritt 5: Query-Log starten
        // Prüfe, ob es eine TOC-Frage ist (bereits oben definiert)
        
        queryId = await startQueryLog({
          libraryId,
          chatId: activeChatId,
          userEmail: userEmail || undefined,
          sessionId: sessionId || undefined,
          question: message,
          mode: modeNow,
          queryType: isTOCQuery ? 'toc' : 'question', // Setze queryType basierend auf der Frage
          answerLength,
          retriever: effectiveRetriever,
          targetLanguage: effectiveChatConfig.targetLanguage,
          character: effectiveChatConfig.character,
          socialContext: effectiveChatConfig.socialContext,
          genderInclusive: effectiveChatConfig.genderInclusive,
          facetsSelected,
          filtersNormalized: { ...built.normalized },
          filtersPinecone: { ...built.pinecone },
        })

        // Nur für normale Queries: Frage-Analyse speichern
        if (questionAnalysis && !isTOCQuery) {
          await setQuestionAnalysis(queryId, {
            recommendation: questionAnalysis.recommendation,
            confidence: questionAnalysis.confidence,
            reasoning: questionAnalysis.reasoning,
          })
        }

        // Schritt 6: Retriever ausführen (mit Status-Updates)
        send({ type: 'retrieval_start', retriever: effectiveRetriever })
        
        const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
        send({ type: 'llm_start', model })

        const { answer, references, suggestedQuestions, storyTopicsData } = await runChatOrchestrated({
          retriever: effectiveRetriever,
          libraryId,
          userEmail: userEmail,
          question: message,
          answerLength,
          filters: built.mongo,
          queryId,
          context: { vectorIndex: ctx.vectorIndex },
          chatConfig: effectiveChatConfig,
          chatHistory: chatHistory,
          facetsSelected: facetsSelected,
          facetDefs: facetDefs,
          isTOCQuery: isTOCQuery,
          apiKey: libraryApiKey,
          onStatusUpdate: (msg) => {
            // Send progress updates - Timing wird später gesetzt
            if (msg.includes('Suche nach relevanten Quellen')) {
              send({ type: 'retrieval_progress', sourcesFound: 0, message: msg })
            } else if (msg.includes('Quellen gefunden')) {
              const countMatch = msg.match(/(\d+)/)
              const count = countMatch ? parseInt(countMatch[1], 10) : 0
              // retrievalMs wird später gesetzt, verwende 0 als Platzhalter
              send({ type: 'retrieval_progress', sourcesFound: count, message: msg })
            } else if (msg.includes('Erstelle Prompt')) {
              send({ type: 'prompt_building', message: msg })
            } else if (msg.includes('Generiere Antwort')) {
              send({ type: 'llm_progress', message: msg })
            } else if (msg.includes('Verarbeite Antwort')) {
              send({ type: 'parsing_response', message: msg })
            }
          },
          onProcessingStep: (step) => {
            // Sende complete-Steps direkt, wenn sie verfügbar sind
            collectedSteps.push(step)
            send(step)
          },
        })

        // Schritt 10: Complete
        const completeStep: ChatProcessingStep = {
          type: 'complete',
          answer,
          references,
          suggestedQuestions,
          queryId,
          chatId: activeChatId,
          ...(storyTopicsData && { storyTopicsData }),
        }
        
        // Füge complete-Step zu den gesammelten Steps hinzu
        const allSteps = [...collectedSteps, completeStep]
        
        // Speichere Processing-Logs in der Datenbank
        await updateQueryLogPartial(queryId, {
          processingLogs: allSteps,
        })
        
        send(completeStep)

        controller.close()
      } catch (error) {
        console.error('[api/chat/stream] Error:', error)
        const errorStep: ChatProcessingStep = { type: 'error', error: error instanceof Error ? error.message : String(error) }
        
        // Wenn ein queryId vorhanden ist, speichere auch die Error-Logs
        // queryId ist nur innerhalb des try-Blocks verfügbar, daher müssen wir es außerhalb prüfen
        try {
          if (typeof queryId !== 'undefined') {
            const allSteps = [...collectedSteps, errorStep]
            await updateQueryLogPartial(queryId, {
              processingLogs: allSteps,
            }).catch(() => {
              // Ignoriere Fehler beim Speichern der Logs
            })
          }
        } catch {
          // Ignoriere Fehler beim Speichern der Error-Logs
        }
        
        send(errorStep)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

