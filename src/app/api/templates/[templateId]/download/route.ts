/**
 * @fileoverview Template Download API Route
 * 
 * @description
 * API route for downloading templates as Markdown files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadTemplateFromMongoDB, serializeTemplateToMarkdown } from '@/lib/templates/template-service-mongodb'

async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * GET /api/templates/[templateId]/download
 * Lädt ein Template als Markdown-Datei herunter
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

    // Serialisiere zu Markdown (mit creation-Block für Export)
    const markdownContent = serializeTemplateToMarkdown(template, true)
    
    // Gib als Download zurück
    return new NextResponse(markdownContent, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${templateId}.md"`,
      },
    })
  } catch (error) {
    console.error('[API][Templates][Download] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}









