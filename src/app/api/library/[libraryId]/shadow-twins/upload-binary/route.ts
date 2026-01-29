/**
 * @fileoverview Shadow-Twin Binary Fragment Upload API
 *
 * @description
 * Lädt ein Binary-Fragment (z.B. Cover-Bild) über den ShadowTwinService hoch.
 * 
 * Verwendet automatisch den korrekten Storage basierend auf der Library-Konfiguration:
 * - MongoDB-Modus: Upload nach Azure Blob Storage, Fragment in MongoDB speichern
 * - Filesystem-Modus: Upload ins Shadow-Twin-Verzeichnis, Storage-API-URL generieren
 *
 * Das Frontend muss sich nicht um Storage-Details kümmern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { FileLogger } from '@/lib/debug/logger'

/**
 * POST: Lädt ein Binary-Fragment hoch
 * 
 * Request: multipart/form-data
 * - file: Binärdaten
 * - sourceId: ID der Quelldatei
 * - sourceName: Name der Quelldatei (optional)
 * - parentId: Parent-ID (optional)
 * - kind: 'image' | 'audio' | 'video' (default: 'image')
 * 
 * Response:
 * {
 *   fragment: {
 *     name: string,
 *     url?: string,
 *     resolvedUrl: string,
 *     hash: string,
 *     size: number,
 *     mimeType: string,
 *     kind: string
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
    }

    const { libraryId } = await params

    // FormData parsen
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sourceId = formData.get('sourceId') as string | null
    const sourceName = (formData.get('sourceName') as string) || ''
    const parentId = (formData.get('parentId') as string) || ''
    const kindRaw = (formData.get('kind') as string) || 'image'

    // Validierung
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    }
    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    // Kind validieren
    const validKinds = ['image', 'audio', 'video'] as const
    const kind = validKinds.includes(kindRaw as typeof validKinds[number])
      ? (kindRaw as 'image' | 'audio' | 'video')
      : 'image'

    // Library laden
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Buffer aus File erstellen
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    FileLogger.info('shadow-twins/upload-binary', 'Binary-Fragment-Upload gestartet', {
      libraryId,
      sourceId,
      fileName: file.name,
      mimeType: file.type,
      size: buffer.length,
      kind,
    })

    // ShadowTwinService erstellen
    const service = await ShadowTwinService.create({
      library,
      userEmail,
      sourceId,
      sourceName,
      parentId,
    })

    // Upload durchführen
    const fragment = await service.uploadBinaryFragment({
      buffer,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      kind,
    })

    FileLogger.info('shadow-twins/upload-binary', 'Binary-Fragment-Upload erfolgreich', {
      libraryId,
      sourceId,
      fileName: fragment.name,
      resolvedUrl: fragment.resolvedUrl,
      hash: fragment.hash,
    })

    return NextResponse.json({
      fragment: {
        name: fragment.name,
        url: fragment.url,
        fileId: fragment.fileId,
        resolvedUrl: fragment.resolvedUrl,
        hash: fragment.hash,
        size: fragment.size,
        mimeType: fragment.mimeType,
        kind: fragment.kind,
      },
    }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/upload-binary', 'Upload fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
