/**
 * @fileoverview Template Import API Route
 * 
 * @description
 * API route for importing templates from Storage to MongoDB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { importTemplateFromStorage, listTemplatesInStorage } from '@/lib/templates/template-import-export'
import { getServerProvider } from '@/lib/storage/server-provider'

async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * GET /api/templates/import
 * Listet verfügbare Templates im Storage auf
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const libraryId = searchParams.get('libraryId')
    
    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 })
    }

    // Storage Provider erstellen
    const provider = await getServerProvider(userEmail, libraryId)
    const templates = await listTemplatesInStorage(provider)
    
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[API][Templates][Import] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/templates/import
 * Importiert ein Template aus Storage nach MongoDB
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const body = await request.json()
    const { fileName, libraryId } = body
    
    if (!fileName || !libraryId) {
      return NextResponse.json(
        { error: 'fileName und libraryId sind erforderlich' },
        { status: 400 }
      )
    }

    // Storage Provider erstellen
    const provider = await getServerProvider(userEmail, libraryId)
    const result = await importTemplateFromStorage(provider, fileName, libraryId, userEmail)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API][Templates][Import] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

