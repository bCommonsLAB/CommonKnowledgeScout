import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { IntegrationTestFileKind } from '@/lib/integration-tests/pdf-upload'

/**
 * Erkennt automatisch den ersten unterstützten Dateityp im Ordner.
 * 
 * Scannt alle Dateien im Ordner und gibt den ersten gefundenen Typ zurück.
 * Priorität: PDF > Audio > Markdown > TXT > Website
 */
export async function GET(request: NextRequest) {
  try {
    // Auth-Modi: Clerk oder Internal Token
    const internalToken = String(request.headers.get('X-Internal-Token') || '').trim()
    const expectedInternal = String(process.env.INTERNAL_TEST_TOKEN || '').trim()
    const hasValidInternalToken = expectedInternal.length > 0 && internalToken === expectedInternal

    let userEmail = ''
    if (hasValidInternalToken) {
      const url = new URL(request.url)
      userEmail = (url.searchParams.get('userEmail') || '').trim()
      if (!userEmail) {
        return NextResponse.json({ error: 'userEmail erforderlich (Internal Token Mode)' }, { status: 400 })
      }
    } else {
      const { userId } = getAuth(request)
      if (!userId) {
        return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      }
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) {
        return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
      }
    }

    const url = new URL(request.url)
    const libraryId = (url.searchParams.get('libraryId') || '').trim()
    const folderId = (url.searchParams.get('folderId') || 'root').trim()

    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })
    }

    // Lade alle Dateien im Ordner
    const provider = await getServerProvider(userEmail, libraryId)
    const items = await provider.listItemsById(folderId)
    const files = items.filter(it => it.type === 'file')

    if (files.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        detectedKind: null,
        message: 'Keine Dateien im Ordner gefunden'
      })
    }

    // Priorität: PDF > Audio > Markdown > TXT > Website
    const priority: IntegrationTestFileKind[] = ['pdf', 'audio', 'markdown', 'txt', 'website']
    
    for (const kind of priority) {
      const { detectFileKind } = await import('@/lib/integration-tests/pdf-upload')
      const found = files.find(it => {
        const name = String(it.metadata?.name || '')
        const mimeType = typeof it.metadata?.mimeType === 'string' ? String(it.metadata.mimeType) : undefined
        return detectFileKind(name, mimeType) === kind
      })
      
      if (found) {
        return NextResponse.json({
          ok: true,
          detectedKind: kind,
          firstFile: {
            id: found.id,
            name: String(found.metadata?.name || ''),
            mimeType: typeof found.metadata?.mimeType === 'string' ? String(found.metadata.mimeType) : undefined,
          },
        })
      }
    }

    // Kein unterstützter Typ gefunden
    return NextResponse.json({
      ok: true,
      detectedKind: null,
      message: 'Kein unterstützter Dateityp gefunden (PDF, Audio, Markdown, TXT, Website)',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
