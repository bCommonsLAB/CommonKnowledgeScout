/**
 * @fileoverview Template Config API Route
 * 
 * @description
 * API route für das Laden von Template-Konfigurationen als strukturierte Objekte.
 * Gibt das vollständige TemplateDocument zurück (inkl. creation-Block).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadTemplateFromMongoDB } from '@/lib/templates/template-service-mongodb'

async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * GET /api/templates/[templateId]/config
 * Lädt ein Template als strukturiertes Objekt (inkl. creation-Block)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const { templateId } = await params
    const searchParams = request.nextUrl.searchParams
    const libraryId = searchParams.get('libraryId')
    
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    }

    // TODO: Admin-Check implementieren
    const isAdmin = false

    // Lade Template aus MongoDB
    const template = await loadTemplateFromMongoDB(templateId, libraryId, userEmail, isAdmin)
    
    if (!template) {
      return NextResponse.json({ error: 'Template nicht gefunden' }, { status: 404 })
    }

    // Gib vollständiges TemplateDocument zurück
    return NextResponse.json({ template })
  } catch (error) {
    console.error('[API][Templates][Config] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}









