import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getByFileIds, getCollectionNameForLibrary, getCollectionOnly } from '@/lib/repositories/vector-repo'
import { convertMongoDocToDocCardMeta, type MongoDocForConversion } from '@/lib/repositories/doc-meta-formatter'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { Document } from 'mongodb'

/**
 * GET /api/chat/[libraryId]/docs/by-fileids
 * Lädt Dokumente nach fileIds (für Referenzen, unabhängig von Pagination)
 * 
 * Query-Parameter:
 * - fileId: Mehrere fileIds können übergeben werden (z.B. ?fileId=id1&fileId=id2)
 * 
 * Response:
 * {
 *   items: DocCardMeta[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    
    // Rate-Limiting-Schutz: Versuche auth() und currentUser() mit Fehlerbehandlung
    let userId: string | null = null
    let userEmail = ''
    
    try {
      const authResult = await auth()
      userId = authResult.userId || null
      
      if (userId) {
        const user = await currentUser()
        userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      }
    } catch (authError) {
      // Rate Limit Error: Loggen aber nicht abbrechen (für öffentliche Libraries)
      const isRateLimit = authError && typeof authError === 'object' && 'status' in authError && authError.status === 429
      if (isRateLimit) {
        console.warn('[API] Clerk Rate Limit beim Laden der Dokumente, versuche ohne Auth fortzufahren')
        // Für öffentliche Libraries können wir ohne Auth fortfahren
      } else {
        // Andere Auth-Fehler: Weiterwerfen
        throw authError
      }
    }

    // Chat-Kontext laden (nutzt userEmail für nicht-öffentliche Bibliotheken)
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Zugriff: wenn nicht public, Auth erforderlich
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const url = new URL(request.url)
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    
    // Extrahiere alle fileIds aus Query-Parametern
    const fileIds = url.searchParams.getAll('fileId')
    
    if (fileIds.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein fileId-Parameter erforderlich' }, { status: 400 })
    }

    // Lade Dokumente nach fileIds
    const docsMap = await getByFileIds(libraryKey, libraryId, fileIds)
    
    if (docsMap.size === 0) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    // Lade vollständige Dokument-Daten für alle Felder (inkl. docMetaJson)
    const col = await getCollectionOnly(libraryKey)
    
    // Konvertiere alle Dokumente zu DocCardMeta-Format
    const items: DocCardMeta[] = await Promise.all(
      Array.from(docsMap.values()).map(async (doc) => {
        // Lade vollständige Dokument-Daten für docMetaJson (falls benötigt)
        const fullDoc = await col.findOne(
          { _id: `${doc.fileId}-meta`, kind: 'meta' } as Partial<Document>,
          {
            projection: {
              _id: 0,
              fileId: 1,
              fileName: 1,
              title: 1,
              shortTitle: 1,
              year: 1,
              authors: 1,
              speakers: 1,
              speakers_image_url: 1,
              track: 1,
              date: 1,
              region: 1,
              docType: 1,
              source: 1,
              tags: 1,
              slug: 1,
              coverImageUrl: 1,
              upsertedAt: 1,
              'docMetaJson.title': 1,
              'docMetaJson.shortTitle': 1,
              'docMetaJson.speakers': 1,
              'docMetaJson.track': 1,
              'docMetaJson.date': 1,
              'docMetaJson.speakers_image_url': 1,
              'docMetaJson.slug': 1,
              'docMetaJson.coverImageUrl': 1,
              'docMetaJson.pages': 1,
            }
          }
        )

        if (fullDoc && typeof fullDoc === 'object' && 'fileId' in fullDoc && typeof fullDoc.fileId === 'string') {
          // Verwende vollständige Dokument-Daten
          return convertMongoDocToDocCardMeta(fullDoc as unknown as MongoDocForConversion)
        }
        
        // Fallback: Verwende Daten aus doc (VectorDocument)
        return convertMongoDocToDocCardMeta(doc)
      })
    )

    return NextResponse.json({ items }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

