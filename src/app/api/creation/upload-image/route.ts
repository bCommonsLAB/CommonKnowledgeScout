import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { LibraryService } from '@/lib/services/library-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * API Route zum Hochladen von Bildern nach Azure Blob Storage
 * Wird vom Creation Wizard beim Speichern aufgerufen
 */
export async function POST(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser()
    if (!user?.emailAddresses?.length) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      )
    }
    const userEmail = user.emailAddresses[0].emailAddress

    // Library-ID aus Header
    const libraryId = request.headers.get('X-Library-Id')
    if (!libraryId) {
      return NextResponse.json(
        { error: 'X-Library-Id Header fehlt' },
        { status: 400 }
      )
    }

    // Library-Zugriff prüfen
    const libraryService = LibraryService.getInstance()
    const libraries = await libraryService.getUserLibraries(userEmail)
    const hasAccess = libraries.some(lib => lib.id === libraryId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Kein Zugriff auf diese Library' },
        { status: 403 }
      )
    }

    // FormData parsen
    const formData = await request.formData()
    const file = formData.get('file')
    const key = formData.get('key')
    const ownerId = formData.get('ownerId')
    const scope = formData.get('scope')

    // Validierung
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Keine gültige Datei übergeben' },
        { status: 400 }
      )
    }

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'key Parameter fehlt' },
        { status: 400 }
      )
    }

    if (!ownerId || typeof ownerId !== 'string') {
      return NextResponse.json(
        { error: 'ownerId Parameter fehlt' },
        { status: 400 }
      )
    }

    if (!scope || typeof scope !== 'string' || (scope !== 'books' && scope !== 'sessions')) {
      return NextResponse.json(
        { error: 'scope Parameter fehlt oder ungültig (muss "books" oder "sessions" sein)' },
        { status: 400 }
      )
    }

    // Datei-Validierung: nur Bilder, max 10MB
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Ungültiger Dateityp: ${file.type}. Nur Bilder erlaubt.` },
        { status: 400 }
      )
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Datei zu groß: ${(file.size / 1024 / 1024).toFixed(2)} MB. Maximum: 10 MB.` },
        { status: 400 }
      )
    }

    // Azure Storage prüfen
    const azureConfig = getAzureStorageConfig()
    if (!azureConfig) {
      return NextResponse.json(
        { error: 'Azure Storage nicht konfiguriert' },
        { status: 500 }
      )
    }

    const azureStorage = new AzureStorageService()
    if (!azureStorage.isConfigured()) {
      return NextResponse.json(
        { error: 'Azure Storage Service nicht konfiguriert' },
        { status: 500 }
      )
    }

    // Container prüfen
    const containerExists = await azureStorage.containerExists(azureConfig.containerName)
    if (!containerExists) {
      return NextResponse.json(
        { error: `Azure Storage Container '${azureConfig.containerName}' existiert nicht` },
        { status: 500 }
      )
    }

    // Buffer erstellen und Hash berechnen
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = calculateImageHash(buffer)

    // Extension aus Dateiname oder MIME-Type ableiten
    const fileName = file.name || 'image'
    const extension = fileName.split('.').pop()?.toLowerCase() || 
      (file.type === 'image/jpeg' ? 'jpg' : 
       file.type === 'image/png' ? 'png' : 
       file.type === 'image/gif' ? 'gif' : 
       file.type === 'image/webp' ? 'webp' : 
       file.type === 'image/svg+xml' ? 'svg' : 'jpg')

    // Upload nach Azure
    const azureUrl = await azureStorage.uploadImageToScope(
      azureConfig.containerName,
      libraryId,
      scope as 'books' | 'sessions',
      ownerId,
      hash,
      extension,
      buffer
    )

    return NextResponse.json({ url: azureUrl })
  } catch (error) {
    console.error('[upload-image] Fehler:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Upload' },
      { status: 500 }
    )
  }
}



