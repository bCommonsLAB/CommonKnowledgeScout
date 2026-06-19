/**
 * @fileoverview Library Export API Route
 * 
 * @description
 * API route for exporting a library configuration as JSON.
 * Exports library settings without sensitive data (API keys, secrets).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { stripLibraryConfigSecrets } from '@/lib/library/config-export'
import type { Library } from '@/types/library'

async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * GET /api/libraries/[id]/export
 * Exportiert eine Bibliothek als JSON (ohne sensible Daten)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const { id: libraryId } = await params
    
    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId ist erforderlich' },
        { status: 400 }
      )
    }

    const libraryService = LibraryService.getInstance()
    // Export nur für Owner zugänglich (enthält Konfigurationsdaten)
    const isOwner = await libraryService.isOwner(userEmail, libraryId)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner koennen Libraries exportieren.' },
        { status: 403 }
      )
    }
    const library = await libraryService.getLibrary(userEmail, libraryId)

    if (!library) {
      return NextResponse.json(
        { error: 'Bibliothek nicht gefunden' },
        { status: 404 }
      )
    }

    // Erstelle Export-Objekt ohne sensible Daten.
    // Variante B: KOMPLETTE config uebernehmen, nur Secrets per Deny-List
    // entfernen (stripLibraryConfigSecrets). So gehen keine Nicht-Secret-
    // Felder mehr still verloren (z.B. nextcloud-URL, shadowTwin, translations).
    const exportData: Partial<Library> = {
      label: library.label,
      path: library.path,
      type: library.type,
      isEnabled: library.isEnabled,
      transcription: library.transcription,
      config: library.config
        ? stripLibraryConfigSecrets(library.config)
        : undefined,
    }

    // JSON als Download zurückgeben
    const jsonString = JSON.stringify(exportData, null, 2)
    const filename = `library-${library.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`
    
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[API][Libraries][Export] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

