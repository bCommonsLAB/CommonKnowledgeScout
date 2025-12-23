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
import { getLocale } from '@/lib/i18n'
import { startQueryLog } from '@/lib/logging/query-logger'
import { updateQueryLogPartial, findQueryByQuestionAndContext } from '@/lib/db/queries-repo'
import { buildCacheHashParams } from '@/lib/chat/utils/cache-hash-builder'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'
import { appendRetrievalStep } from '@/lib/logging/query-logger'
import { runChatOrchestrated } from '@/lib/chat/orchestrator'
import { buildFilters } from '@/lib/chat/common/filters'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { decideRetrieverMode } from '@/lib/chat/common/retriever-decider'
import { createChat, touchChat, getChatById } from '@/lib/db/chats-repo'
import {
  ANSWER_LENGTH_ZOD_ENUM,
  isValidTargetLanguage,
  isValidSocialContext,
  normalizeCharacterToArray,
  normalizeAccessPerspectiveToArray,
  parseCharacterFromUrlParam,
  parseAccessPerspectiveFromUrlParam,
  characterArrayToString,
  accessPerspectiveArrayToString,
  resolveTargetLanguage,
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
 * Route Segment Config: Maximale Ausführungsdauer für diesen Route Handler
 * 
 * Standard in Next.js: 10s (Development), 60s (Production)
 * Für LLM-Chat-Requests benötigen wir mehr Zeit (bis zu 4 Minuten)
 */
export const maxDuration = 240 // 240 Sekunden (4 Minuten)

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
        
        // Nur Parameter, die tatsächlich Facetten sind (inkl. shortTitle)
        parsedUrl.searchParams.forEach((v, k) => {
          // Überspringe Chat-Konfigurations-Parameter
          if (['retriever', 'targetLanguage', 'character', 'socialContext', 'genderInclusive', 'chatId', 'llmModel'].includes(k)) {
            return
          }
          // Facetten-Parameter ODER shortTitle übernehmen
          if (facetMetaKeys.has(k) || k === 'shortTitle') {
            if (!facetsSelected[k]) facetsSelected[k] = [] as unknown[]
            ;(facetsSelected[k] as unknown[]).push(v)
          }
        })
        
        // Erstelle Kopie von facetsSelected für Cache (behält shortTitle)
        const facetsSelectedForCache = { ...facetsSelected }
        
        // Mappe shortTitle zu fileIds über MongoDB Vector Search (kind: 'meta')
        // WICHTIG: facetsSelected wird für MongoDB modifiziert, aber facetsSelectedForCache behält shortTitle für Cache
        if (facetsSelected.shortTitle && Array.isArray(facetsSelected.shortTitle) && facetsSelected.shortTitle.length > 0) {
          const { getCollectionNameForLibrary, getCollectionOnly } = await import('@/lib/repositories/vector-repo')
          const libraryKey = getCollectionNameForLibrary(ctx.library)
          const col = await getCollectionOnly(libraryKey)
          
          const shortTitles = facetsSelected.shortTitle as string[]
          // Exakte Suche nach shortTitle in Meta-Dokumenten (kind: 'meta')
          const docs = await col.find(
            { kind: 'meta', 'docMetaJson.shortTitle': { $in: shortTitles } },
            { projection: { fileId: 1, 'docMetaJson.shortTitle': 1, _id: 0 } }
          ).toArray()
          
          const fileIds = docs
            .map(d => typeof d.fileId === 'string' ? d.fileId : null)
            .filter((id): id is string => !!id)
          
          if (fileIds.length > 0) {
            // Ersetze shortTitle durch fileId für MongoDB Vector Search (nur in facetsSelected, nicht in facetsSelectedForCache)
            delete facetsSelected.shortTitle
            facetsSelected.fileId = fileIds
            // Setze auch in URL-Parametern für buildFilters
            parsedUrl.searchParams.delete('shortTitle')
            fileIds.forEach(fileId => parsedUrl.searchParams.append('fileId', fileId))
          } else {
            // Keine Dokumente gefunden, entferne shortTitle-Filter
            console.warn('[Stream] Keine Dokumente mit shortTitle gefunden:', { shortTitles })
            delete facetsSelected.shortTitle
            delete facetsSelectedForCache.shortTitle
            parsedUrl.searchParams.delete('shortTitle')
          }
        }

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
          // WICHTIG: Für anonyme Nutzer muss sessionId vorhanden sein, sonst kann Chat nicht gefunden werden
          const userEmailOrSessionId = userEmail || sessionId
          if (!userEmailOrSessionId) {
            console.warn('[stream] Chat-ID vorhanden, aber weder userEmail noch sessionId - erstelle neuen Chat:', {
              chatId,
              hasUserEmail: !!userEmail,
              hasSessionId: !!sessionId,
              userId: userId || null,
            })
            // Erstelle neuen Chat statt Fehler
            const chatTitle = message.slice(0, 60)
            activeChatId = await createChat(libraryId, userEmail || sessionId || '', chatTitle)
          } else {
            const existingChat = await getChatById(chatId, userEmailOrSessionId)
            if (!existingChat) {
              console.warn('[stream] Chat nicht gefunden - erstelle neuen Chat:', {
                chatId,
                userEmail: userEmail || null,
                sessionId: sessionId || null,
                userEmailOrSessionId,
                isEmail: userEmailOrSessionId.includes('@'),
              })
              // Erstelle neuen Chat statt Fehler
              const chatTitle = message.slice(0, 60)
              activeChatId = await createChat(libraryId, userEmailOrSessionId, chatTitle)
            } else {
              // Chat gefunden, verwende ihn
              activeChatId = chatId
              await touchChat(chatId)
            }
          }
        }

        // Ermittle UI-Locale für 'global' targetLanguage Konvertierung (früh, damit es überall verfügbar ist)
        const acceptLanguage = request.headers.get('accept-language') || undefined
        const cookieLocale = request.cookies.get('locale')?.value
        const uiLocale = getLocale(undefined, cookieLocale, acceptLanguage)
        
        // Chat-Config bestimmen
        const targetLanguageParam = parsedUrl.searchParams.get('targetLanguage')
        const characterParam = parsedUrl.searchParams.get('character')
        const accessPerspectiveParam = parsedUrl.searchParams.get('accessPerspective')
        const socialContextParam = parsedUrl.searchParams.get('socialContext')
        const genderInclusiveParam = parsedUrl.searchParams.get('genderInclusive')
        const llmModelParam = parsedUrl.searchParams.get('llmModel')
        const llmTemperatureParam = parsedUrl.searchParams.get('llmTemperature')
        
        // Parse character Parameter aus URL (komma-separierter String → Character[] Array)
        const effectiveCharacter = parseCharacterFromUrlParam(characterParam)
        // Parse accessPerspective Parameter aus URL (komma-separierter String → AccessPerspective[] Array)
        const effectiveAccessPerspective = parseAccessPerspectiveFromUrlParam(accessPerspectiveParam)
        
        const effectiveTargetLanguage = isValidTargetLanguage(targetLanguageParam)
          ? targetLanguageParam
          : ctx.chat.targetLanguage
        
        const effectiveChatConfig = {
          ...ctx.chat,
          targetLanguage: effectiveTargetLanguage,
          character: effectiveCharacter ?? normalizeCharacterToArray(ctx.chat.character),
          accessPerspective: effectiveAccessPerspective ?? normalizeAccessPerspectiveToArray(ctx.chat.accessPerspective),
          socialContext: isValidSocialContext(socialContextParam)
            ? socialContextParam
            : ctx.chat.socialContext,
          genderInclusive: genderInclusiveParam === 'true' 
            ? true 
            : genderInclusiveParam === 'false' 
            ? false 
            : ctx.chat.genderInclusive ?? false,
        }
        
        console.log('[Chat API] effectiveChatConfig bestimmt:', {
          targetLanguageParam,
          effectiveTargetLanguage,
          ctxChatTargetLanguage: ctx.chat.targetLanguage,
          isValidTargetLanguage: isValidTargetLanguage(targetLanguageParam),
          effectiveChatConfigTargetLanguage: effectiveChatConfig.targetLanguage,
          uiLocale,
        })

        // Schritt 1.5: Cache-Check für bestehende Query
        // Prüfe, ob bereits eine identische Query mit Antwort existiert
        // Verwendet Hash-basierte Suche für optimale Performance
        // Dies gilt sowohl für TOC-Queries als auch für normale Fragen (gleiche Logik)
        // WICHTIG: Für konsistenten Cache-Hash müssen wir den Retriever vor dem Cache-Check bestimmen,
        // da beim Speichern auch der automatisch entschiedene Retriever verwendet wird.
        // Variablen außerhalb des try-Blocks deklarieren, damit sie später verfügbar sind
        let cacheHashForLog: string | undefined = undefined
        let documentCount: number | undefined = undefined
        let retrieverForCache: string | undefined = undefined
        
        try {
          // Schritt 1: Filter aufbauen (für Retriever-Entscheidung benötigt)
          // Verwende temporären Retriever für Filter-Aufbau (wird später überschrieben)
          const tempRetrieverForFilters: 'chunk' | 'summary' | 'chunkSummary' = explicitRetrieverValue 
            ? explicitRetrieverValue 
            : (isTOCQuery ? 'summary' : 'chunk')
          const built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, tempRetrieverForFilters)
          
          // Schritt 2: Retriever-Modus automatisch entscheiden (für Cache-Hash benötigt)
          const retrieverDecision = await decideRetrieverMode({
            libraryId,
            userEmail: userEmail || '',
            filter: built.mongo,
            isTOCQuery,
            explicitRetriever: explicitRetrieverValue,
          })
          
          // Konvertiere chunkSummary zu 'chunk' für Cache-Hash (konsistent mit Speichern)
          const effectiveRetrieverForCache: 'chunk' | 'summary' = retrieverDecision.mode === 'chunkSummary' 
            ? 'chunk' 
            : retrieverDecision.mode === 'summary'
            ? 'summary'
            : 'chunk'
          
          // Verwende expliziten Retriever-Wert, falls vorhanden, sonst automatisch entschiedenen
          retrieverForCache = explicitRetrieverValue || effectiveRetrieverForCache
          
          // Verwende zentrale Funktion für Cache-Hash-Berechnung
          // uiLocale wurde bereits oben definiert
          const cacheHashParamsForLog = await buildCacheHashParams({
            libraryId,
            question: message,
            queryType: isTOCQuery ? 'toc' : 'question',
            answerLength,
            targetLanguage: effectiveChatConfig.targetLanguage,
            character: effectiveChatConfig.character,
            accessPerspective: effectiveChatConfig.accessPerspective,
            socialContext: effectiveChatConfig.socialContext,
            genderInclusive: effectiveChatConfig.genderInclusive,
            retriever: retrieverForCache,
            facetsSelected: facetsSelectedForCache,
            library: ctx.library, // Verwende Library-Objekt für DocumentCount-Berechnung
            uiLocale: uiLocale, // UI-Locale für 'global' targetLanguage Konvertierung
          })
          
          documentCount = cacheHashParamsForLog.documentCount
          
          cacheHashForLog = createCacheHash(cacheHashParamsForLog)
          
          // Sende Cache-Check-Step (Start) mit Debug-Informationen
          send({
            type: 'cache_check',
            parameters: {
              targetLanguage: effectiveChatConfig.targetLanguage,
              character: characterArrayToString(effectiveChatConfig.character),
              accessPerspective: accessPerspectiveArrayToString(effectiveChatConfig.accessPerspective),
              socialContext: effectiveChatConfig.socialContext,
              filters: facetsSelectedForCache,
            },
            cacheHash: cacheHashForLog,
            documentCount,
          })
          
          // Hash-basierte Cache-Suche (findQueryByQuestionAndContext berechnet intern den Hash)
          // WICHTIG: Verwende den gleichen Retriever-Wert wie beim Hash-Berechnen oben
          const cachedQuery = await findQueryByQuestionAndContext({
            libraryId,
            userEmail: userEmail || undefined,
            sessionId: sessionId || undefined,
            question: message.trim(),
            queryType: isTOCQuery ? 'toc' : 'question',
            answerLength,
            targetLanguage: effectiveChatConfig.targetLanguage,
            character: effectiveChatConfig.character,
            accessPerspective: effectiveChatConfig.accessPerspective,
            socialContext: effectiveChatConfig.socialContext,
            genderInclusive: effectiveChatConfig.genderInclusive,
            retriever: retrieverForCache,
            facetsSelected: Object.keys(facetsSelectedForCache).length > 0 ? facetsSelectedForCache : undefined,
          })

          // Wenn Cache gefunden wurde und Antwort vorhanden ist
          if (cachedQuery && ((cachedQuery.answer && cachedQuery.answer.trim().length > 0) || cachedQuery.storyTopicsData)) {
            // Verwende die queryId aus dem Cache (falls vorhanden) oder erstelle neue
            const finalQueryId = cachedQuery.queryId || `cached-${Date.now()}`
            
            // Wenn queryId noch nicht gesetzt wurde, setze sie für später
            queryId = finalQueryId
            
            // Sende Cache-Check-Complete-Step (gefunden) mit Debug-Informationen
            send({
              type: 'cache_check_complete',
              found: true,
              queryId: finalQueryId,
              cacheHash: cacheHashForLog,
              documentCount,
              cachedQueryId: cachedQuery.queryId,
            })
            
            // Sammle Cache-Check-Steps für Logs (auch wenn Cache gefunden wurde)
            const cacheSteps: ChatProcessingStep[] = [
              {
                type: 'cache_check',
                parameters: {
                  targetLanguage: effectiveChatConfig.targetLanguage,
                  character: characterArrayToString(effectiveChatConfig.character),
                  accessPerspective: accessPerspectiveArrayToString(effectiveChatConfig.accessPerspective),
                  socialContext: effectiveChatConfig.socialContext,
                  filters: facetsSelected,
                },
                cacheHash: cacheHashForLog,
                documentCount,
              },
              {
                type: 'cache_check_complete',
                found: true,
                queryId: finalQueryId,
                cacheHash: cacheHashForLog,
                documentCount,
                cachedQueryId: cachedQuery.queryId,
              },
            ]
            
            // Speichere Cache-Check-Step auch im retrieval Array (für Debug-Zwecke)
            if (cachedQuery.queryId) {
              const cacheCheckStep = {
                indexName: '',
                namespace: '',
                stage: 'cache_check' as const,
                level: 'question' as const,
                cacheHash: cacheHashForLog,
                documentCount,
                cacheFound: true,
                cachedQueryId: cachedQuery.queryId,
                startedAt: new Date(),
                endedAt: new Date(),
                timingMs: 0,
              }
              await appendRetrievalStep(cachedQuery.queryId, cacheCheckStep)
            }
            
            // Sende sofort als complete-Step mit Cache-Daten
            // WICHTIG: storyTopicsData muss explizit gesetzt werden (auch wenn undefined, damit Frontend es erkennt)
            const completeStep: ChatProcessingStep & { storyTopicsData?: import('@/types/story-topics').StoryTopicsData } = {
              type: 'complete',
              answer: cachedQuery.answer || '',
              references: cachedQuery.references || [],
              suggestedQuestions: cachedQuery.suggestedQuestions || [],
              queryId: finalQueryId,
              chatId: activeChatId,
            }
            // Setze storyTopicsData explizit, auch wenn es undefined ist (damit Frontend es erkennt)
            if (cachedQuery.storyTopicsData !== undefined && cachedQuery.storyTopicsData !== null) {
              completeStep.storyTopicsData = cachedQuery.storyTopicsData
              console.log('[stream/route] storyTopicsData wird gesendet:', {
                hasStoryTopicsData: true,
                title: cachedQuery.storyTopicsData?.title,
                topicsCount: cachedQuery.storyTopicsData?.topics?.length,
              })
            } else {
              console.log('[stream/route] storyTopicsData ist nicht vorhanden:', {
                hasStoryTopicsData: false,
                storyTopicsDataValue: cachedQuery.storyTopicsData,
              })
            }
            console.log('[stream/route] Sende complete-Step:', {
              type: completeStep.type,
              hasStoryTopicsData: !!completeStep.storyTopicsData,
              answerLength: completeStep.answer?.length,
            })
            send(completeStep)
            
            // Speichere Cache-Check-Logs in der gecachten Query (für Debug-Zwecke)
            if (cachedQuery.queryId) {
              await updateQueryLogPartial(cachedQuery.queryId, {
                status: 'ok',
                processingLogs: [...(cachedQuery.processingLogs || []), ...cacheSteps],
              })
            }
            
            controller.close()
            isStreamActive = false
            return
          } else {
            // Cache-Check durchgeführt, aber kein Cache gefunden
            send({
              type: 'cache_check_complete',
              found: false,
              cacheHash: cacheHashForLog,
              documentCount,
            })
          }
        } catch (error) {
          // Bei Fehler im Cache-Check: Weiter mit normaler Verarbeitung
          console.error('[stream] Fehler beim Cache-Check:', error)
          send({
            type: 'cache_check_complete',
            found: false,
          })
        }
        
        // Wenn Cache gefunden wurde, wurde bereits return aufgerufen
        // An dieser Stelle wird nur fortgesetzt, wenn kein Cache gefunden wurde

        // Schritt 2: Filter aufbauen (für Retriever-Entscheidung benötigt)
        // WICHTIG: Filter wurden bereits oben für Cache-Check aufgebaut, verwende diese
        // (built wurde bereits im try-Block erstellt, falls Cache-Check durchgeführt wurde)
        
        // Wenn Cache-Check bereits durchgeführt wurde, wurden Filter bereits aufgebaut
        // Ansonsten baue Filter jetzt auf
        let built: { normalized: Record<string, unknown>; mongo: Record<string, unknown> }
        let retrieverDecision: { mode: 'chunk' | 'chunkSummary' | 'summary'; reason: string }
        let effectiveRetriever: 'chunk' | 'summary'
        let internalRetriever: 'chunk' | 'chunkSummary' | 'summary'
        
        if (retrieverForCache !== undefined) {
          // Filter wurden bereits oben aufgebaut, verwende die bereits getroffene Entscheidung
          // (Diese Variablen wurden bereits im try-Block gesetzt)
          // Wir müssen sie hier neu setzen, da sie im try-Block lokal waren
          const tempRetrieverForFilters: 'chunk' | 'summary' | 'chunkSummary' = explicitRetrieverValue 
            ? explicitRetrieverValue 
            : (isTOCQuery ? 'summary' : 'chunk')
          built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, tempRetrieverForFilters)
          retrieverDecision = await decideRetrieverMode({
            libraryId,
            userEmail: userEmail || '',
            filter: built.mongo,
            isTOCQuery,
            explicitRetriever: explicitRetrieverValue,
          })
          effectiveRetriever = retrieverDecision.mode === 'chunkSummary' 
            ? 'chunk' 
            : retrieverDecision.mode === 'summary'
            ? 'summary'
            : 'chunk'
          internalRetriever = retrieverDecision.mode
        } else {
          // Filter wurden noch nicht aufgebaut (Cache-Check wurde übersprungen)
          const tempRetrieverForFilters: 'chunk' | 'summary' | 'chunkSummary' = explicitRetrieverValue 
            ? explicitRetrieverValue 
            : (isTOCQuery ? 'summary' : 'chunk')
          built = buildFilters(parsedUrl, ctx.library, userEmail || '', libraryId, tempRetrieverForFilters)
          retrieverDecision = await decideRetrieverMode({
            libraryId,
            userEmail: userEmail || '',
            filter: built.mongo,
            isTOCQuery,
            explicitRetriever: explicitRetrieverValue,
          })
          effectiveRetriever = retrieverDecision.mode === 'chunkSummary' 
            ? 'chunk' 
            : retrieverDecision.mode === 'summary'
            ? 'summary'
            : 'chunk'
          internalRetriever = retrieverDecision.mode
          retrieverForCache = explicitRetrieverValue || effectiveRetriever
        }

        send({
          type: 'retriever_selected',
          retriever: effectiveRetriever, // UI-kompatibel (chunkSummary → chunk)
          reason: retrieverDecision.reason,
        })

        const modeNow = internalRetriever === 'summary' ? 'summaries' as const : 'chunks' as const

        // Schritt 3: Query-Log starten
        // Prüfe, ob es eine TOC-Frage ist (bereits oben definiert)
        
        // Konvertiere 'global' targetLanguage zur tatsächlichen Sprache für Query-Log
        // WICHTIG: Query-Log muss die tatsächliche Sprache enthalten, nicht 'global'
        const effectiveTargetLanguageForLog = effectiveChatConfig.targetLanguage === 'global' && uiLocale
          ? resolveTargetLanguage('global', uiLocale)
          : effectiveChatConfig.targetLanguage
        
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
          targetLanguage: effectiveTargetLanguageForLog, // Verwende konvertierte Sprache (nicht 'global')
          character: effectiveChatConfig.character, // Array (kann leer sein)
          accessPerspective: effectiveChatConfig.accessPerspective, // Array (kann leer sein)
          socialContext: effectiveChatConfig.socialContext,
          genderInclusive: effectiveChatConfig.genderInclusive,
          facetsSelected: facetsSelectedForCache, // Verwende facetsSelectedForCache für Cache (behält shortTitle)
          filtersNormalized: { ...built.normalized },
          documentCount, // Übergebe bereits berechnete documentCount (verhindert fehlerhafte Neuberechnung)
        })
        
        // Speichere Cache-Check-Step auch im retrieval Array (auch wenn kein Cache gefunden wurde)
        if (cacheHashForLog !== undefined && documentCount !== undefined) {
          const cacheCheckStep = {
            indexName: '',
            namespace: '',
            stage: 'cache_check' as const,
            level: 'question' as const,
            cacheHash: cacheHashForLog,
            documentCount,
            cacheFound: false,
            startedAt: new Date(),
            endedAt: new Date(),
            timingMs: 0,
          }
          await appendRetrievalStep(queryId, cacheCheckStep)
        }

        // Schritt 5: Retriever ausführen (mit Status-Updates)
        send({ type: 'retrieval_start', retriever: effectiveRetriever })
        
        // LLM-Modell muss explizit gesetzt sein (deterministisch, kein Fallback)
        if (!llmModelParam) {
          throw new Error('llmModel Parameter ist erforderlich')
        }
        if (!llmTemperatureParam) {
          throw new Error('llmTemperature Parameter ist erforderlich')
        }
        const model = llmModelParam
        const temperature = Number(llmTemperatureParam)
        if (isNaN(temperature)) {
          throw new Error('llmTemperature muss eine gültige Zahl sein')
        }
        send({ type: 'llm_start', model })

        // Normalisiere chatConfig für Orchestrator (character und accessPerspective müssen Arrays sein)
        const normalizedChatConfig = {
          ...effectiveChatConfig,
          character: normalizeCharacterToArray(effectiveChatConfig.character),
          accessPerspective: normalizeAccessPerspectiveToArray(effectiveChatConfig.accessPerspective),
        }

        // uiLocale wurde bereits oben definiert, verwende es hier
        const { answer, references, suggestedQuestions, storyTopicsData } = await runChatOrchestrated({
          retriever: internalRetriever, // Verwende internen Retriever (kann chunkSummary sein)
          libraryId,
          userEmail: userEmail,
          context: {},
          question: message,
          llmModel: llmModelParam, // LLM-Modell (muss gesetzt sein)
          temperature: temperature, // Temperature (muss gesetzt sein)
          answerLength,
          filters: built.mongo,
          queryId,
          chatConfig: normalizedChatConfig,
          chatHistory: chatHistory,
          facetsSelected: facetsSelected,
          facetDefs: facetDefs,
          isTOCQuery: isTOCQuery,
          apiKey: libraryApiKey,
          uiLocale: uiLocale, // UI-Locale für 'global' targetLanguage
          onProcessingStep: (step) => {
            // Prüfe, ob der Stream noch aktiv ist
            if (!isStreamActive) {
              return
            }
            
            // Alle Processing-Steps werden gesammelt und direkt gesendet
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

