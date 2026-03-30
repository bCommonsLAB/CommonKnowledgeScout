import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/library/[libraryId]/depublish-site
 * Setzt sitePublished auf false (anonyme Startseite aus), Draft in web/ bleibt unverändert.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    }

    const { libraryId } = await params
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 })
    }

    const libraryService = LibraryService.getInstance()
    const allowed = await isCoCreatorOrOwner(libraryId, userEmail)
    if (!allowed) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const fullLibrary = await libraryService.getLibraryById(libraryId)
    if (!fullLibrary) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }

    const pub = fullLibrary.config?.publicPublishing
    // siteUrl entfernen: anonyme Clients dürfen keine alte Live-URL mehr sehen
    const { siteUrl: _dropSiteUrl, ...pubWithoutUrl } = pub || {}
    void _dropSiteUrl
    const updatedLibrary = {
      ...fullLibrary,
      config: {
        ...fullLibrary.config,
        publicPublishing: {
          ...pubWithoutUrl,
          slugName: pub?.slugName || '',
          publicName: pub?.publicName || fullLibrary.label,
          description: pub?.description || '',
          isPublic: pub?.isPublic ?? false,
          sitePublished: false,
        },
      },
    }

    const ownerEmail = await libraryService.findOwnerEmailForLibraryId(libraryId)
    if (!ownerEmail) {
      return NextResponse.json(
        { error: 'Owner der Library konnte nicht ermittelt werden.' },
        { status: 500 },
      )
    }

    const ok = await libraryService.updateLibrary(ownerEmail, updatedLibrary)
    if (!ok) {
      return NextResponse.json({ error: 'Library konnte nicht aktualisiert werden.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sitePublished: false })
  } catch (error) {
    console.error('[depublish-site] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
