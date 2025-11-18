import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary } from '@/lib/repositories/doc-meta-repo'
import { getCollection } from '@/lib/mongodb-service'
import type { DocMeta } from '@/types/doc-meta'

/**
 * GET /api/chat/[libraryId]/doc-by-slug
 * Findet ein Dokument anhand des Slugs (docMetaJson.slug)
 * 
 * Query-Parameter:
 * - slug: Der Slug des Dokuments (erforderlich)
 * 
 * Response:
 * {
 *   fileId: string
 *   fileName?: string
 *   docMetaJson?: Record<string, unknown>
 * }
 */
export async function GET(
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

    const url = new URL(request.url)
    const slug = url.searchParams.get('slug')
    console.log('[doc-by-slug] Request:', {
      libraryId,
      slug,
      userEmail: userEmail || 'anonymous',
      isPublic: ctx.library.config?.publicPublishing?.isPublic,
    })
    
    if (!slug) {
      return NextResponse.json({ error: 'slug erforderlich' }, { status: 400 })
    }

    // Verwende Collection-Name aus Config (deterministisch, keine Owner-Email-Ermittlung mehr)
    const libraryKey = getCollectionNameForLibrary(ctx.library)
    console.log('[doc-by-slug] MongoDB Collection:', {
      libraryKey,
    })
    
    const col = await getCollection<DocMeta>(libraryKey)

    // Dokument anhand des Slugs finden
    // MongoDB unterstützt dot-notation für verschachtelte Felder
    console.log('[doc-by-slug] Suche Dokument mit slug:', slug)
    
    // Prüfe zuerst, wie viele Dokumente in der Collection sind
    const totalDocs = await col.countDocuments({})
    console.log('[doc-by-slug] Anzahl Dokumente in Collection:', totalDocs)
    
    // Versuche zuerst mit dot-notation (wenn docMetaJson als Objekt gespeichert ist)
    let doc = await col.findOne(
      { 'docMetaJson.slug': slug },
      { projection: { _id: 0, fileId: 1, fileName: 1, docMetaJson: 1 } }
    )
    
    console.log('[doc-by-slug] Query mit dot-notation Ergebnis:', {
      found: !!doc,
      fileId: doc?.fileId,
    })
    
    // Falls nicht gefunden, versuche mit String-Suche (wenn docMetaJson als String gespeichert ist)
    if (!doc) {
      console.log('[doc-by-slug] Dokument nicht mit dot-notation gefunden, versuche String-Suche...')
      // Lade alle Dokumente und suche manuell
      const allDocs = await col.find(
        {},
        { projection: { _id: 0, fileId: 1, fileName: 1, docMetaJson: 1 } }
      ).limit(1000).toArray()
      
      console.log('[doc-by-slug] Lade Dokumente für String-Suche:', {
        count: allDocs.length,
        firstDocFileId: allDocs[0]?.fileId,
        firstDocMetaJsonType: typeof allDocs[0]?.docMetaJson,
      })
      
      for (const d of allDocs) {
        let docMetaJson: Record<string, unknown> | undefined
        if (typeof d.docMetaJson === 'string') {
          try {
            docMetaJson = JSON.parse(d.docMetaJson) as Record<string, unknown>
          } catch (parseError) {
            console.warn('[doc-by-slug] Fehler beim Parsen von docMetaJson:', parseError)
            continue
          }
        } else if (d.docMetaJson && typeof d.docMetaJson === 'object') {
          docMetaJson = d.docMetaJson as Record<string, unknown>
        }
        
        const docSlug = docMetaJson?.slug
        console.log('[doc-by-slug] Prüfe Dokument:', {
          fileId: d.fileId,
          hasDocMetaJson: !!docMetaJson,
          docSlug,
          matches: docSlug === slug,
        })
        
        if (docMetaJson && typeof docMetaJson.slug === 'string' && docMetaJson.slug === slug) {
          doc = d
          console.log('[doc-by-slug] ✅ Dokument gefunden mit String-Suche:', { fileId: d.fileId })
          break
        }
      }
    } else {
      console.log('[doc-by-slug] ✅ Dokument gefunden mit dot-notation:', { fileId: doc.fileId })
    }

    if (!doc) {
      console.log('[doc-by-slug] ⚠️ Dokument nicht gefunden für slug:', slug)
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    const docMetaJson = (doc.docMetaJson && typeof doc.docMetaJson === 'object')
      ? doc.docMetaJson as Record<string, unknown>
      : {}

    return NextResponse.json({
      fileId: doc.fileId,
      fileName: typeof doc.fileName === 'string' ? doc.fileName : undefined,
      docMetaJson,
    })
  } catch (error) {
    console.error('[doc-by-slug] ERROR:', error)
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

