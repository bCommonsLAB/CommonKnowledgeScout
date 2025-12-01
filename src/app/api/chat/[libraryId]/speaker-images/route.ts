import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import type { Document } from 'mongodb'

/**
 * API-Route für lazy-loading von Speaker-Image-URLs
 * 
 * Lädt die Image-URLs für ein bestimmtes Dokument erst bei Bedarf,
 * um die initiale Datenmenge zu reduzieren.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    const url = new URL(req.url)
    const fileId = url.searchParams.get('fileId')

    console.log('[API][speaker-images] Request:', { libraryId, fileId, hasUserId: !!userId, userEmail })

    if (!fileId) {
      console.log('[API][speaker-images] Fehler: fileId fehlt')
      return NextResponse.json({ error: 'fileId Parameter erforderlich' }, { status: 400 })
    }

    // Chat-Kontext laden
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      console.log('[API][speaker-images] Fehler: Bibliothek nicht gefunden', { libraryId })
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      console.log('[API][speaker-images] Fehler: Nicht authentifiziert', { libraryId, isPublic: ctx.library.config?.publicPublishing?.isPublic })
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Verwende Collection-Name aus Config (deterministisch, keine Owner-Email-Ermittlung mehr)
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    console.log('[API][speaker-images] MongoDB Collection:', { libraryKey })
    const col = await getCollectionOnly(libraryKey)

    // Lade nur speakers_image_url für das spezifische Meta-Dokument
    const doc = await col.findOne(
      { _id: `${fileId}-meta`, kind: 'meta' } as Partial<Document>,
      {
        projection: {
          _id: 0,
          fileId: 1,
          speakers_image_url: 1,
          'docMetaJson.speakers_image_url': 1,
          'docMetaJson': 1, // Temporär: Lade komplettes docMetaJson für Debugging
        }
      }
    )

    console.log('[API][speaker-images] Dokument gefunden:', { 
      found: !!doc, 
      fileId,
      hasTopLevel: !!doc?.speakers_image_url,
      hasDocMeta: !!doc?.docMetaJson,
      docMetaKeys: doc?.docMetaJson && typeof doc.docMetaJson === 'object' 
        ? Object.keys(doc.docMetaJson as Record<string, unknown>).slice(0, 10)
        : []
    })

    if (!doc) {
      console.log('[API][speaker-images] Dokument nicht gefunden für fileId:', fileId)
      return NextResponse.json({ speakers_image_url: [] }, { status: 200 })
    }

    // Extrahiere speakers_image_url (Priorität: Top-Level > docMetaJson)
    const toStrArr = (val: unknown): string[] | undefined => {
      if (Array.isArray(val)) {
        return val.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      }
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : undefined
        } catch {
          return undefined
        }
      }
      return undefined
    }

    const docMeta = doc.docMetaJson && typeof doc.docMetaJson === 'object' 
      ? doc.docMetaJson as Record<string, unknown> 
      : undefined

    const speakersImageUrlTopLevel = toStrArr(doc.speakers_image_url)
    const speakersImageUrlDocMeta = docMeta ? toStrArr(docMeta.speakers_image_url) : undefined
    const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta || []

    console.log('[API][speaker-images] Extraktion:', {
      fileId,
      topLevel: speakersImageUrlTopLevel,
      docMeta: speakersImageUrlDocMeta,
      final: speakersImageUrl,
      imageCount: speakersImageUrl.length,
      docMetaHasSpeakersImageUrl: docMeta ? 'speakers_image_url' in docMeta : false,
      docMetaSpeakersImageUrlType: docMeta && 'speakers_image_url' in docMeta 
        ? typeof docMeta.speakers_image_url 
        : 'N/A'
    })

    return NextResponse.json({ speakers_image_url: speakersImageUrl }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[API][speaker-images] Fehler:', { msg, stack })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

