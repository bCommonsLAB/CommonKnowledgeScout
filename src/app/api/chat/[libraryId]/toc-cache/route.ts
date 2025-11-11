import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { findQueryByQuestionAndContext } from '@/lib/db/queries-repo'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'

/**
 * API-Endpoint zum Prüfen, ob eine Inhaltsverzeichnis-Query bereits gecacht ist
 * 
 * GET /api/chat/[libraryId]/toc-cache?question=...&targetLanguage=...&character=...&socialContext=...&genderInclusive=...&retriever=...&year=...&tags=...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    // Session-ID aus Header lesen (für anonyme Nutzer)
    const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
    const sessionId = sessionIdHeader || undefined

    const { libraryId } = await params
    const parsedUrl = new URL(request.url)
    const question = parsedUrl.searchParams.get('question')
    const targetLanguage = parsedUrl.searchParams.get('targetLanguage')
    const character = parsedUrl.searchParams.get('character')
    const socialContext = parsedUrl.searchParams.get('socialContext')
    const genderInclusive = parsedUrl.searchParams.get('genderInclusive')
    const retriever = parsedUrl.searchParams.get('retriever')

    if (!question) {
      return NextResponse.json({ error: 'question parameter required' }, { status: 400 })
    }

    // Lade Library-Context für Facetten-Definitionen (unterstützt auch öffentliche Libraries ohne Email)
    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 })
    }

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Für anonyme Nutzer: Session-ID muss vorhanden sein
    if (!userEmail && !sessionId) {
      return NextResponse.json({ error: 'Session-ID erforderlich für anonyme Nutzer' }, { status: 400 })
    }

    // Extrahiere Filter-Parameter (nur Facetten, keine Chat-Konfiguration)
    const facetDefs = parseFacetDefs(ctx.library)
    const facetsSelected: Record<string, unknown> = {}
    const facetMetaKeys = new Set(facetDefs.map(d => d.metaKey))
    
    // Nur Parameter, die tatsächlich Facetten sind
    parsedUrl.searchParams.forEach((v, k) => {
      // Überspringe Chat-Konfigurations-Parameter
      if (['retriever', 'targetLanguage', 'character', 'socialContext', 'genderInclusive', 'chatId', 'question'].includes(k)) {
        return
      }
      // Nur Facetten-Parameter übernehmen
      if (facetMetaKeys.has(k)) {
        if (!facetsSelected[k]) facetsSelected[k] = [] as unknown[]
        ;(facetsSelected[k] as unknown[]).push(v)
      }
    })

    // Suche nach bestehender Query
    const cachedQuery = await findQueryByQuestionAndContext({
      libraryId,
      userEmail: userEmail || undefined,
      sessionId: sessionId || undefined,
      question,
      queryType: 'toc', // Suche nur nach TOC-Queries
      targetLanguage: targetLanguage || undefined,
      character: character || undefined,
      socialContext: socialContext || undefined,
      genderInclusive: genderInclusive === 'true' ? true : genderInclusive === 'false' ? false : undefined,
      retriever: retriever || undefined,
      facetsSelected: Object.keys(facetsSelected).length > 0 ? facetsSelected : undefined,
    })

    // Debug-Logging für Fehlerdiagnose
    if (!cachedQuery) {
      console.log('[toc-cache] Keine Query gefunden für:', {
        libraryId,
        userEmail,
        question: question.substring(0, 50) + '...',
        queryType: 'toc',
        targetLanguage,
        character,
        socialContext,
        genderInclusive: genderInclusive === 'true' ? true : genderInclusive === 'false' ? false : undefined,
        retriever,
        facetsSelected: Object.keys(facetsSelected).length > 0 ? facetsSelected : undefined,
      })
    }

    // Prüfe, ob die Query eine Antwort oder storyTopicsData hat
    // (storyTopicsData ist wichtiger für TOC-Queries, auch wenn answer noch null ist)
    if (cachedQuery && (cachedQuery.answer || cachedQuery.storyTopicsData)) {
      console.log('[toc-cache] ✅ Query gefunden:', {
        queryId: cachedQuery.queryId,
        retriever: cachedQuery.retriever,
        status: cachedQuery.status,
        hasAnswer: !!cachedQuery.answer,
        hasStoryTopicsData: !!cachedQuery.storyTopicsData,
        answerLength: cachedQuery.answer?.length || 0,
      })
      return NextResponse.json({
        found: true,
        queryId: cachedQuery.queryId,
        answer: cachedQuery.answer || null,
        references: cachedQuery.references,
        suggestedQuestions: cachedQuery.suggestedQuestions,
        storyTopicsData: cachedQuery.storyTopicsData, // Strukturierte Themenübersicht, falls vorhanden
        createdAt: cachedQuery.createdAt.toISOString(),
      })
    }
    
    // Debug: Logge, wenn Query gefunden wurde, aber keine Daten hat
    if (cachedQuery) {
      console.log('[toc-cache] ⚠️ Query gefunden, aber keine Daten:', {
        queryId: cachedQuery.queryId,
        retriever: cachedQuery.retriever,
        status: cachedQuery.status,
        hasAnswer: !!cachedQuery.answer,
        hasStoryTopicsData: !!cachedQuery.storyTopicsData,
      })
    }

    return NextResponse.json({ found: false })
  } catch (error) {
    console.error('[api/chat] toc-cache error', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

