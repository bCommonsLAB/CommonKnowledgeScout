/**
 * @fileoverview Shadow-Twin Cover-Image Upload API
 *
 * @description
 * Kombinierte API zum Hochladen eines Cover-Bildes und Patchen des Frontmatters.
 * 
 * Diese API abstrahiert den gesamten Cover-Bild-Workflow:
 * 1. Bild hochladen (Azure oder Filesystem, je nach Config)
 * 2. Fragment in MongoDB/Filesystem registrieren
 * 3. Frontmatter mit coverImageUrl patchen
 * 
 * Das Frontend muss sich nicht um Storage-Details oder Markdown-Updates kümmern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { FileLogger } from '@/lib/debug/logger'

/**
 * POST: Lädt ein Cover-Bild hoch und patcht das Frontmatter
 * 
 * Request: multipart/form-data
 * - file: Binärdaten (Bild)
 * - sourceId: ID der Quelldatei
 * - sourceName: Name der Quelldatei (optional)
 * - parentId: Parent-ID (optional)
 * - kind: 'transcript' | 'transformation' (default: 'transformation')
 * - targetLanguage: Zielsprache (default: 'de')
 * - templateName: Template-Name (optional, für transformation)
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
 *   },
 *   markdown: string,
 *   artifactId: string
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
    const kindRaw = (formData.get('kind') as string) || 'transformation'
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de'
    const templateName = (formData.get('templateName') as string) || undefined

    // Validierung
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    }
    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    // Kind validieren
    const validKinds = ['transcript', 'transformation'] as const
    const kind = validKinds.includes(kindRaw as typeof validKinds[number])
      ? (kindRaw as 'transcript' | 'transformation')
      : 'transformation'

    // Library laden
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Buffer aus File erstellen
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    FileLogger.info('shadow-twins/upload-cover-image', 'Cover-Image-Upload gestartet', {
      libraryId,
      sourceId,
      fileName: file.name,
      mimeType: file.type,
      size: buffer.length,
      kind,
      targetLanguage,
      templateName,
    })

    // ShadowTwinService erstellen
    const service = await ShadowTwinService.create({
      library,
      userEmail,
      sourceId,
      sourceName,
      parentId,
    })

    // Kombinierte Methode aufrufen: Upload + Frontmatter-Patch
    const result = await service.uploadCoverImageAndPatchFrontmatter({
      buffer,
      fileName: file.name,
      mimeType: file.type || 'image/png',
      kind,
      targetLanguage,
      templateName,
    })

    FileLogger.info('shadow-twins/upload-cover-image', 'Cover-Image-Upload erfolgreich', {
      libraryId,
      sourceId,
      fileName: result.fragment.name,
      resolvedUrl: result.fragment.resolvedUrl,
      thumbnailName: result.thumbnailFragment?.name,
      thumbnailUrl: result.thumbnailFragment?.resolvedUrl,
      artifactId: result.artifactId,
    })

    return NextResponse.json({
      fragment: {
        name: result.fragment.name,
        url: result.fragment.url,
        fileId: result.fragment.fileId,
        resolvedUrl: result.fragment.resolvedUrl,
        hash: result.fragment.hash,
        size: result.fragment.size,
        mimeType: result.fragment.mimeType,
        kind: result.fragment.kind,
      },
      // Thumbnail-Fragment (wenn generiert)
      thumbnailFragment: result.thumbnailFragment ? {
        name: result.thumbnailFragment.name,
        url: result.thumbnailFragment.url,
        resolvedUrl: result.thumbnailFragment.resolvedUrl,
        hash: result.thumbnailFragment.hash,
        size: result.thumbnailFragment.size,
        mimeType: result.thumbnailFragment.mimeType,
      } : undefined,
      markdown: result.markdown,
      artifactId: result.artifactId,
    }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/upload-cover-image', 'Upload fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
