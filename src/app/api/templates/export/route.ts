/**
 * @fileoverview Template Export API Route
 * 
 * @description
 * API route for exporting templates from MongoDB to Storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { exportTemplateToStorage } from '@/lib/templates/template-import-export'
import { getServerProvider } from '@/lib/storage/server-provider'

async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * POST /api/templates/export
 * Exportiert ein Template aus MongoDB nach Storage
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const body = await request.json()
    const { templateId, libraryId } = body
    
    if (!templateId || !libraryId) {
      return NextResponse.json(
        { error: 'templateId und libraryId sind erforderlich' },
        { status: 400 }
      )
    }

    // Storage Provider erstellen
    const provider = await getServerProvider(userEmail, libraryId)

    // TODO: Admin-Check implementieren
    const isAdmin = false

    const result = await exportTemplateToStorage(provider, templateId, libraryId, userEmail, isAdmin)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API][Templates][Export] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

