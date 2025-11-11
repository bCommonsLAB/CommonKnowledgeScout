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
import { startQueryLog } from '@/lib/logging/query-logger'
import { updateQueryLogPartial } from '@/lib/db/queries-repo'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { buildFilters } from '@/lib/chat/common/filters'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { decideRetrieverMode } from '@/lib/chat/common/retriever-decider'
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
  asTOC: z.boolean().optional(), // Optional: Antwort als Themenübersicht formatieren
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
      
      // Flag um zu prüfen, ob der Stream noch aktiv ist
      let isStreamActive = true
      
      function send(status: ChatProcessingStep) {
        // Prüfe, ob der Stream noch aktiv ist, bevor gesendet wird
        if (!isStreamActive) {
          return
        }
        
        try {
        // Sammle alle Steps (außer complete und error, die werden separat behandelt)
        if (status.type !== 'complete' && status.type !== 'error') {
          collectedSteps.push(status)
        }
        controller.enqueue(encoder.encode(formatSSE(status)))
        } catch (error) {
          // Wenn der Controller bereits geschlossen ist, ignoriere den Fehler
          // und markiere den Stream als inaktiv
          if (error instanceof TypeError && error.message.includes('closed')) {
            isStreamActive = false
            return
          }
          // Andere Fehler weiterwerfen
          throw error
        }
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
          isStreamActive = false
          return
        }

        // Zugriff: wenn nicht public, Auth erforderlich
        if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
          send({ type: 'error', error: 'Nicht authentifiziert' })
          controller.close()
          isStreamActive = false
          return
        }

        // Für anonyme Nutzer: Session-ID muss vorhanden sein
        if (!userEmail && !sessionId) {
          send({ type: 'error', error: 'Session-ID erforderlich für anonyme Nutzer' })
          controller.close()
          isStreamActive = false
          return
        }

        // Body validieren
        const json = await request.json().catch(() => ({}))
        const body = chatRequestSchema.safeParse(json)
        if (!body.success) {
          send({ type: 'error', error: 'Ungültige Anfrage' })
          controller.close()
          isStreamActive = false
          return
        }

        const { message, answerLength, chatHistory, chatId: bodyChatId, asTOC } = body.data

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

        // Schritt 1: TOC-Query bestimmen
        // Prüfe ZUERST, ob es eine TOC-Query ist (explizite TOC-Frage ODER asTOC Flag)
        const { TOC_QUESTION } = await import('@/lib/chat/constants')
        const isTOCQuery = message.trim() === TOC_QUESTION.trim() || (asTOC === true)
        
        const retrieverParamRaw = (parsedUrl.searchParams.get('retriever') || '').toLowerCase()
        // Bestimme expliziten Retriever: nur wenn nicht leer und nicht 'auto'
        const explicitRetrieverValue: 'summary' | 'chunk' | null = 
          retrieverParamRaw === 'summary' || retrieverParamRaw === 'doc'
            ? 'summary'
            : retrieverParamRaw === 'chunk'
            ? 'chunk'
            : null // 'auto' oder leer → null (automatische Entscheidung)
        
        // Verwende Library-spezifischen API-Key, falls vorhanden
        const libraryApiKey = ctx.library.config?.publicPublishing?.apiKey
        
        // Schritt 1: Chat-Verwaltung
        let activeChatId: string
        if (!chatId) {
          // Chat-Title direkt aus Frage generieren (erste 60 Zeichen)
          const chatTitle = message.slice(0, 60)
          // Verwende userEmail oder sessionId für Chat-Erstellung
          activeChatId = await createChat(libraryId, userEmail || sessionId || '', chatTitle)
        } else {
          activeChatId = chatId
          const existingChat = await getChatById(chatId, userEmail || sessionId || '')
          if (!existingChat) {
            send({ type: 'error', error: 'Chat nicht gefunden' })
            controller.close()
            isStreamActive = false
            return
          }
          await touchChat(chatId)
        }

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

        // Schritt 2: Filter aufbauen (für Retriever-Entscheidung benötigt)
        // Verwende temporären Retriever für Filter-Aufbau (wird später überschrieben)
        // Bei Auto-Modus (explicitRetrieverValue === null): TOC-Queries verwenden 'summary', normale Fragen 'chunk'
        // HINWEIS: chunkSummary wird hier noch nicht verwendet, da die Entscheidung erst nach Filter-Aufbau getroffen wird.
        // chunkSummary benötigt die gleichen Filter wie summary (beide filtern auf Dokumentebene).
        const tempRetrieverForFilters: 'chunk' | 'summary' | 'chunkSummary' = explicitRetrieverValue 
          ? explicitRetrieverValue 
          : (isTOCQuery ? 'summary' : 'chunk')
        const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, tempRetrieverForFilters)

        // Schritt 3: Retriever-Modus automatisch entscheiden
        const retrieverDecision = await decideRetrieverMode({
          libraryId,
          userEmail: userEmail || '',
          filter: built.mongo,
          isTOCQuery,
          explicitRetriever: explicitRetrieverValue, // null bei 'auto' oder leer → automatische Entscheidung
        })

        // Konvertiere chunkSummary zu 'chunk' für UI-Kompatibilität (interne Option)
        const effectiveRetriever: 'chunk' | 'summary' = retrieverDecision.mode === 'chunkSummary' 
          ? 'chunk' 
          : retrieverDecision.mode === 'summary'
          ? 'summary'
          : 'chunk'

        // Interner Retriever-Modus (kann chunkSummary sein)
        const internalRetriever: 'chunk' | 'chunkSummary' | 'summary' = retrieverDecision.mode

        send({
          type: 'retriever_selected',
          retriever: effectiveRetriever, // UI-kompatibel (chunkSummary → chunk)
          reason: retrieverDecision.reason,
        })

        const modeNow = internalRetriever === 'summary' ? 'summaries' as const : 'chunks' as const

        // Schritt 4: Query-Log starten
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
          retriever: internalRetriever, // Verwende internen Retriever (kann chunkSummary sein)
          targetLanguage: effectiveChatConfig.targetLanguage,
          character: effectiveChatConfig.character,
          socialContext: effectiveChatConfig.socialContext,
          genderInclusive: effectiveChatConfig.genderInclusive,
          facetsSelected,
          filtersNormalized: { ...built.normalized },
          filtersPinecone: { ...built.pinecone },
        })

        // Schritt 5: Retriever ausführen (mit Status-Updates)
        send({ type: 'retrieval_start', retriever: effectiveRetriever })
        
        const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
        send({ type: 'llm_start', model })

        const { answer, references, suggestedQuestions, storyTopicsData } = await runChatOrchestrated({
          retriever: internalRetriever, // Verwende internen Retriever (kann chunkSummary sein)
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
            // Prüfe, ob der Stream noch aktiv ist
            if (!isStreamActive) {
              return
            }
            
            // Send progress updates - Timing will be set later
            if (msg.includes('Searching for relevant sources')) {
              send({ type: 'retrieval_progress', sourcesFound: 0, message: msg })
            } else if (msg.includes('sources found')) {
              const countMatch = msg.match(/(\d+)/)
              const count = countMatch ? parseInt(countMatch[1], 10) : 0
              // retrievalMs will be set later, use 0 as placeholder
              send({ type: 'retrieval_progress', sourcesFound: count, message: msg })
            } else if (msg.includes('Building prompt')) {
              send({ type: 'prompt_building', message: msg })
            } else if (msg.includes('Generating answer')) {
              send({ type: 'llm_progress', message: msg })
            } else if (msg.includes('Processing response')) {
              send({ type: 'parsing_response', message: msg })
            }
          },
          onProcessingStep: (step) => {
            // Prüfe, ob der Stream noch aktiv ist
            if (!isStreamActive) {
              return
            }
            
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

        // Prüfe, ob der Stream noch aktiv ist, bevor geschlossen wird
        // (kann bereits geschlossen sein, wenn der Client die Verbindung abgebrochen hat)
        if (isStreamActive) {
          try {
        controller.close()
          } catch (error) {
            // Ignoriere Fehler beim Schließen (Controller könnte bereits geschlossen sein)
            console.error('[api/chat/stream] Fehler beim Schließen des Controllers:', error)
          }
          isStreamActive = false
        }
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
        
        // Prüfe, ob der Stream noch aktiv ist, bevor der Error-Step gesendet wird
        if (isStreamActive) {
          try {
        send(errorStep)
            try {
        controller.close()
            } catch (closeError) {
              // Ignoriere Fehler beim Schließen (Controller könnte bereits geschlossen sein)
              console.error('[api/chat/stream] Fehler beim Schließen des Controllers im catch-Block:', closeError)
            }
            isStreamActive = false
          } catch {
            // Ignoriere Fehler beim Senden des Error-Steps (z.B. wenn Controller bereits geschlossen)
            isStreamActive = false
          }
        }
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

