import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/library/explore-by-slug/[slug]
 * Lädt Library-Metadaten für Explore nach Slug, wenn der Nutzer Owner oder Co-Creator ist.
 * Ermöglicht Draft-Test der Startseite, bevor `isPublic` aktiv ist.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

    const { slug } = await params
    if (!slug) {
      return NextResponse.json({ error: 'Slug fehlt' }, { status: 400 })
    }

    const libraryService = LibraryService.getInstance()
    const library = await libraryService.getLibraryByPublishingSlug(slug)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }

    const allowed = await isCoCreatorOrOwner(library.id, userEmail)
    if (!allowed) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const pub = library.config?.publicPublishing
    const safeLibrary = {
      id: library.id,
      label: pub?.publicName || library.label,
      slugName: pub?.slugName || slug,
      description: pub?.description,
      icon: pub?.icon,
      requiresAuth: pub?.requiresAuth === true,
      isPublic: pub?.isPublic === true,
      chat: library.config?.chat,
      siteEnabled: pub?.siteEnabled === true,
      sitePublished: pub?.sitePublished === true,
      siteUrl: pub?.siteUrl,
      siteVersion: pub?.siteVersion,
      sitePublishedAt: pub?.sitePublishedAt,
      exploreContext: 'member' as const,
    }

    return NextResponse.json({ library: safeLibrary })
  } catch (error) {
    console.error('[explore-by-slug] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    )
  }
}
