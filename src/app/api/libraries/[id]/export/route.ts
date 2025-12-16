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
    const library = await libraryService.getLibrary(userEmail, libraryId)
    
    if (!library) {
      return NextResponse.json(
        { error: 'Bibliothek nicht gefunden' },
        { status: 404 }
      )
    }

    // Erstelle Export-Objekt ohne sensible Daten
    const exportData: Partial<Library> = {
      label: library.label,
      path: library.path,
      type: library.type,
      isEnabled: library.isEnabled,
      transcription: library.transcription,
      config: library.config ? {
        // Secretary Service Config (ohne API-Keys)
        secretaryService: library.config.secretaryService ? {
          apiUrl: library.config.secretaryService.apiUrl || '',
          apiKey: '', // API-Key wird nicht exportiert
          pdfDefaults: library.config.secretaryService.pdfDefaults,
        } : undefined,
        
        // Chat Config (vollständig exportieren)
        chat: library.config.chat,
        
        // Creation Config (vollständig exportieren)
        creation: library.config.creation,
        
        // Public Publishing (ohne API-Key)
        publicPublishing: library.config.publicPublishing ? {
          ...library.config.publicPublishing,
          apiKey: undefined, // API-Key wird nicht exportiert
        } : undefined,
      } : undefined,
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

