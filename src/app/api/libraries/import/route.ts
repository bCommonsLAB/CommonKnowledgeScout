/**
 * @fileoverview Library Import API Route
 * 
 * @description
 * API route for importing a library configuration from JSON.
 * Creates a new library with a new ID based on the imported configuration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { v4 as uuidv4 } from 'uuid'
import type { Library } from '@/types/library'

async function getUserEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress || null
}

/**
 * POST /api/libraries/import
 * Importiert eine Bibliothek aus JSON und erstellt sie neu (mit neuer ID)
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const body = await request.json()
    const { libraryData } = body
    
    if (!libraryData || typeof libraryData !== 'object') {
      return NextResponse.json(
        { error: 'libraryData ist erforderlich und muss ein Objekt sein' },
        { status: 400 }
      )
    }

    // Validiere minimale erforderliche Felder
    if (!libraryData.label || !libraryData.type) {
      return NextResponse.json(
        { error: 'label und type sind erforderlich' },
        { status: 400 }
      )
    }

    // Erstelle neue Library mit neuer ID
    const newLibrary: Library = {
      id: uuidv4(), // Neue ID generieren
      label: libraryData.label,
      path: libraryData.path || '',
      type: libraryData.type,
      isEnabled: libraryData.isEnabled !== undefined ? libraryData.isEnabled : true,
      transcription: libraryData.transcription || 'shadowTwin',
      config: {
        // Nur existierende StorageConfig-Felder verwenden
        
        // Secretary Service Config (ohne API-Key, muss neu konfiguriert werden)
        secretaryService: libraryData.config?.secretaryService ? {
          apiUrl: libraryData.config.secretaryService.apiUrl || '',
          apiKey: '', // API-Key muss neu eingegeben werden
          pdfDefaults: libraryData.config.secretaryService.pdfDefaults,
        } : undefined,
        
        // Chat Config
        chat: libraryData.config?.chat,
        
        // Creation Config
        creation: libraryData.config?.creation,
        
        // Public Publishing (ohne API-Key)
        publicPublishing: libraryData.config?.publicPublishing ? {
          ...libraryData.config.publicPublishing,
          apiKey: undefined, // API-Key muss neu eingegeben werden
        } : undefined,
      },
    }

    const libraryService = LibraryService.getInstance()
    const success = await libraryService.updateLibrary(userEmail, newLibrary)
    
    if (success) {
      return NextResponse.json({
        success: true,
        library: newLibrary,
        message: 'Bibliothek erfolgreich importiert',
      })
    } else {
      return NextResponse.json(
        { error: 'Fehler beim Importieren der Bibliothek' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API][Libraries][Import] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

