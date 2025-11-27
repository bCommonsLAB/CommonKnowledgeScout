import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getTranslation, saveTranslation } from '@/lib/db/translations-repo'
import { translateBookData, translateSessionData } from '@/lib/chat/common/document-translation'
import { mapToBookDetail, mapToSessionDetail } from '@/lib/mappers/doc-meta-mappers'
import { getCollectionNameForLibrary, getByFileIds } from '@/lib/repositories/doc-meta-repo'
import type { TargetLanguage } from '@/lib/chat/constants'
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'

/**
 * POST /api/chat/[libraryId]/translate-document
 * Übersetzt ein Dokument (Book oder Session) in die Zielsprache
 * 
 * Request Body:
 * {
 *   fileId: string
 *   viewType: 'book' | 'session'
 *   targetLanguage?: TargetLanguage (optional, verwendet UI-Sprache wenn nicht angegeben)
 * }
 * 
 * Response:
 * {
 *   translatedData: BookDetailData | SessionDetailData
 *   cached: boolean (ob aus Cache geladen)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    // Chat-Kontext laden (unterstützt auch öffentliche Libraries ohne Email)
    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Request Body parsen
    let body: unknown
    try {
      body = await request.json()
      console.log('[translate-document] Request erhalten:', {
        libraryId,
        userEmail: userEmail || 'anonymous',
        body,
      })
    } catch (parseError) {
      console.error('[translate-document] Fehler beim Parsen des Request-Body:', parseError)
      return NextResponse.json(
        { error: 'Ungültiger Request-Body' },
        { status: 400 }
      )
    }
    
    const { fileId, viewType, targetLanguage: requestedTargetLanguage } = body as {
      fileId: string
      viewType: 'book' | 'session'
      targetLanguage?: TargetLanguage
    }

    if (!fileId || !viewType) {
      console.error('[translate-document] Fehlende Parameter:', { fileId, viewType })
      return NextResponse.json(
        { error: 'fileId und viewType erforderlich' },
        { status: 400 }
      )
    }
    
    console.log('[translate-document] Parameter validiert:', {
      fileId,
      viewType,
      requestedTargetLanguage,
    })

    // Zielsprache bestimmen: Request-Parameter > UI-Sprache aus Request > Default
    // Mapping von Locale zu TargetLanguage
    const acceptLanguage = request.headers.get('accept-language') || ''
    const locale = acceptLanguage.split(',')[0]?.split('-')[0] || 'de'
    const localeToTargetMap: Record<string, TargetLanguage> = {
      de: 'de',
      en: 'en',
      it: 'it',
      fr: 'fr',
      es: 'es',
      ar: 'ar',
    }
    const defaultTargetLanguage = localeToTargetMap[locale] || TARGET_LANGUAGE_DEFAULT
    const targetLanguage = requestedTargetLanguage || defaultTargetLanguage
    
    console.log('[translate-document] Zielsprache bestimmt:', {
      acceptLanguage,
      locale,
      requestedTargetLanguage,
      defaultTargetLanguage,
      targetLanguage,
    })

    // API-Key für Library bestimmen
    const apiKey = ctx.library.config?.publicPublishing?.apiKey || process.env.OPENAI_API_KEY || ''
    if (!apiKey) {
      console.error('[translate-document] OpenAI API-Key fehlt')
      return NextResponse.json(
        { error: 'OpenAI API-Key nicht konfiguriert' },
        { status: 500 }
      )
    }
    
    console.log('[translate-document] API-Key vorhanden:', {
      hasLibraryKey: !!ctx.library.config?.publicPublishing?.apiKey,
      hasEnvKey: !!process.env.OPENAI_API_KEY,
    })

    // Cache prüfen
    console.log('[translate-document] Prüfe Cache:', { fileId, targetLanguage })
    const cachedTranslation = await getTranslation(fileId, targetLanguage)
    if (cachedTranslation) {
      console.log('[translate-document] ✅ Cache gefunden für:', { 
        fileId, 
        targetLanguage,
        hasTranslatedData: !!cachedTranslation,
        translatedDataKeys: cachedTranslation && typeof cachedTranslation === 'object' 
          ? Object.keys(cachedTranslation).slice(0, 10) 
          : [],
      })
      return NextResponse.json({
        translatedData: cachedTranslation,
        cached: true,
      })
    }
    
    console.log('[translate-document] ⚠️ Kein Cache gefunden, starte Übersetzung')

    // Verwende Collection-Name aus Config (deterministisch, keine Owner-Email-Ermittlung mehr)
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const docMetaMap = await getByFileIds(libraryKey, libraryId, [fileId])
    const docMeta = docMetaMap.get(fileId)

    if (!docMeta) {
      return NextResponse.json(
        { error: 'Dokument nicht gefunden' },
        { status: 404 }
      )
    }

    // Originalsprache ermitteln
    // Fallback: "en" wenn nicht explizit bestimmt (lowercase für LLM-API)
    const docMetaJson = (docMeta.docMetaJson && typeof docMeta.docMetaJson === 'object')
      ? docMeta.docMetaJson as Record<string, unknown>
      : {}
    
    const languageField = docMetaJson.language
    console.log('[translate-document] 🔍 Originalsprache-Analyse:', {
      languageField,
      languageFieldType: typeof languageField,
      languageFieldValue: languageField,
      isString: typeof languageField === 'string',
      isEmpty: typeof languageField === 'string' && languageField.trim().length === 0,
      isNull: languageField === null,
      isUndefined: languageField === undefined,
      docMetaJsonKeys: Object.keys(docMetaJson).slice(0, 20),
    })
    
    let sourceLanguage: string
    let langSource: string
    
    if (typeof languageField === 'string' && languageField.trim().length > 0) {
      sourceLanguage = languageField.trim().toLowerCase()
      langSource = 'docMetaJson.language (explizit gesetzt)'
    } else {
      sourceLanguage = 'en'
      langSource = 'Fallback (docMetaJson.language fehlt oder leer)'
    }
    
    console.log('[translate-document] ✅ Originalsprache ermittelt:', {
      sourceLanguage,
      source: langSource,
      targetLanguage,
      viewType,
      needsTranslation: sourceLanguage !== targetLanguage.toLowerCase(),
      reason: sourceLanguage !== targetLanguage.toLowerCase()
        ? `Übersetzung nötig: ${sourceLanguage} → ${targetLanguage}`
        : `Keine Übersetzung nötig: Originalsprache (${sourceLanguage}) = Zielsprache (${targetLanguage})`,
    })

    // Übersetzen basierend auf viewType
    let translatedData: BookDetailData | SessionDetailData
    if (viewType === 'session') {
      console.log('[translate-document] Mappe Session-Daten...')
      // Session-Daten mappen und übersetzen
      const sessionData = mapToSessionDetail({
        exists: true,
        fileId,
        docMetaJson,
        fileName: typeof docMeta.fileName === 'string' ? docMeta.fileName : undefined,
        chunkCount: typeof docMeta.chunkCount === 'number' ? docMeta.chunkCount : undefined,
        upsertedAt: typeof docMeta.upsertedAt === 'string' ? docMeta.upsertedAt : undefined,
      } as unknown)
      console.log('[translate-document] Session-Daten gemappt:', {
        title: sessionData.title,
        hasSummary: !!sessionData.summary,
        hasMarkdown: !!sessionData.markdown,
      })
      console.log('[translate-document] Starte Session-Übersetzung...')
      translatedData = await translateSessionData(sessionData, targetLanguage, sourceLanguage, apiKey)
      console.log('[translate-document] ✅ Session-Übersetzung abgeschlossen')
    } else {
      console.log('[translate-document] Mappe Book-Daten...')
      // Book-Daten mappen und übersetzen
      const bookData = mapToBookDetail({
        exists: true,
        fileId,
        docMetaJson,
        chapters: Array.isArray(docMeta.chapters) ? docMeta.chapters : undefined,
        fileName: typeof docMeta.fileName === 'string' ? docMeta.fileName : undefined,
        chunkCount: typeof docMeta.chunkCount === 'number' ? docMeta.chunkCount : undefined,
        chaptersCount: typeof docMeta.chaptersCount === 'number' ? docMeta.chaptersCount : undefined,
        upsertedAt: typeof docMeta.upsertedAt === 'string' ? docMeta.upsertedAt : undefined,
      } as unknown)
      console.log('[translate-document] Book-Daten gemappt:', {
        title: bookData.title,
        chaptersCount: bookData.chapters?.length || 0,
      })
      console.log('[translate-document] Starte Book-Übersetzung...')
      translatedData = await translateBookData(bookData, targetLanguage, sourceLanguage, apiKey)
      console.log('[translate-document] ✅ Book-Übersetzung abgeschlossen')
    }

    // Übersetzung im Cache speichern
    console.log('[translate-document] Speichere Übersetzung im Cache...')
    await saveTranslation(fileId, targetLanguage, translatedData)
    console.log('[translate-document] ✅ Übersetzung im Cache gespeichert')

    return NextResponse.json({
      translatedData,
      cached: false,
    })
  } catch (error) {
    console.error('[translate-document] ERROR:', {
      error,
      message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

