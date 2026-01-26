import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { listIntegrationTestFiles } from '@/lib/integration-tests/pdf-upload'

export async function GET(request: NextRequest) {
  try {
    // Auth-Modi: Clerk oder Internal Token (wie bei /run)
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
    const kindRaw = (url.searchParams.get('kind') || '').trim().toLowerCase()
    const kind =
      kindRaw === 'audio' ? 'audio'
      : kindRaw === 'pdf' ? 'pdf'
      : kindRaw === 'markdown' ? 'markdown'
      : kindRaw === 'txt' ? 'txt'
      : kindRaw === 'website' ? 'website'
      : null

    if (!libraryId) return NextResponse.json({ error: 'libraryId erforderlich' }, { status: 400 })
    if (!kind) return NextResponse.json({ error: 'kind erforderlich (pdf|audio|markdown|txt|website)' }, { status: 400 })

    const files = await listIntegrationTestFiles({ userEmail, libraryId, folderId, kind })
    return NextResponse.json(
      {
        ok: true,
        files: files.map(f => ({
          id: f.itemId,
          name: f.name,
          mimeType: f.mimeType,
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

