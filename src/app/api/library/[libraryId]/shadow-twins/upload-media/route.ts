/**
 * @fileoverview Generalisierte Medien-Upload API
 *
 * Lädt ein Medium (Bild oder PDF) hoch und patcht ein beliebiges
 * Frontmatter-Feld. Unterstützt sowohl String-Felder (coverImageUrl)
 * als auch Array-Felder (speakers_image_url[index], attachments_url[]).
 *
 * Ersetzt die hardcoded upload-cover-image Route durch eine generische Variante.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { FileLogger } from '@/lib/debug/logger'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sourceId = formData.get('sourceId') as string | null
    const sourceName = (formData.get('sourceName') as string) || ''
    const parentId = (formData.get('parentId') as string) || ''
    const fieldKey = formData.get('fieldKey') as string | null
    const arrayIndexStr = formData.get('arrayIndex') as string | null
    const arrayAppend = formData.get('arrayAppend') === 'true'
    const kindRaw = (formData.get('kind') as string) || 'transformation'
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de'
    const templateName = (formData.get('templateName') as string) || undefined

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
    }
    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }
    if (!fieldKey) {
      return NextResponse.json({ error: 'fieldKey ist erforderlich' }, { status: 400 })
    }

    const arrayIndex = arrayIndexStr !== null ? parseInt(arrayIndexStr, 10) : undefined

    const validKinds = ['transcript', 'transformation'] as const
    const kind = validKinds.includes(kindRaw as typeof validKinds[number])
      ? (kindRaw as 'transcript' | 'transformation')
      : 'transformation'

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const isImage = file.type.startsWith('image/')

    FileLogger.info('shadow-twins/upload-media', 'Medien-Upload gestartet', {
      libraryId, sourceId, fileName: file.name, mimeType: file.type,
      size: buffer.length, fieldKey, arrayIndex, arrayAppend, kind,
    })

    const service = await ShadowTwinService.create({
      library, userEmail, sourceId, sourceName, parentId,
    })

    // 1. Datei hochladen (kind muss 'image' | 'audio' | 'video' sein)
    const fragment = await service.uploadBinaryFragment({
      buffer,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      kind: 'image', // PDFs und andere Medien werden ebenfalls als 'image' hochgeladen
      variant: 'original',
    })

    // 2. Thumbnail nur für Bilder generieren
    let thumbnailFragment: typeof fragment | undefined
    if (isImage) {
      try {
        const {
          generateThumbnail: generateThumb,
          generateThumbnailFileName,
          THUMBNAIL_SIZE, THUMBNAIL_FORMAT, THUMBNAIL_QUALITY,
        } = await import('@/lib/image/thumbnail-generator')

        const thumbResult = await generateThumb(buffer, {
          size: THUMBNAIL_SIZE, format: THUMBNAIL_FORMAT, quality: THUMBNAIL_QUALITY,
        })
        const thumbFileName = generateThumbnailFileName(file.name, 'webp')

        thumbnailFragment = await service.uploadBinaryFragment({
          buffer: thumbResult.buffer,
          fileName: thumbFileName,
          mimeType: 'image/webp',
          kind: 'image',
          variant: 'thumbnail',
          sourceHash: fragment.hash,
        })
      } catch (error) {
        FileLogger.warn('shadow-twins/upload-media', 'Thumbnail-Generierung fehlgeschlagen', {
          sourceId, fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 3. Frontmatter patchen: bewusst nur mit Dateinamen.
    // Blob-/Streaming-URLs werden erst bei Anzeige/Auflösung bzw. beim Publizieren benötigt.
    const patchValue = file.name || fragment.name
    const patches = buildFrontmatterPatches(
      fieldKey, patchValue, arrayIndex, arrayAppend,
      thumbnailFragment ? thumbnailFragment.name : undefined,
      // Aktuelles Markdown für Array-Operationen laden
      async () => {
        const artifact = await service.getMarkdown({ kind, targetLanguage, templateName })
        if (!artifact?.markdown) return {}
        const { meta } = parseSecretaryMarkdownStrict(artifact.markdown)
        return meta
      }
    )

    const resolvedPatches = await patches

    const patchResult = await service.patchArtifactFrontmatter({
      kind, targetLanguage, templateName, patches: resolvedPatches,
    })

    FileLogger.info('shadow-twins/upload-media', 'Medien-Upload erfolgreich', {
      libraryId, sourceId, fieldKey, fragmentName: fragment.name,
      resolvedUrl: fragment.resolvedUrl, artifactId: patchResult.id,
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
      thumbnailFragment: thumbnailFragment ? {
        name: thumbnailFragment.name,
        resolvedUrl: thumbnailFragment.resolvedUrl,
      } : undefined,
      markdown: patchResult.markdown,
      artifactId: patchResult.id,
    }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/upload-media', 'Upload fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * Baut die Frontmatter-Patches basierend auf fieldKey und Array-Parametern.
 *
 * String-Felder: { coverImageUrl: "filename.png" }
 * Array-Felder mit Index: { speakers_image_url: ["", "filename.png", ""] } (setzt Index)
 * Array-Felder mit Append: { attachments_url: [...existing, "filename.pdf"] }
 */
async function buildFrontmatterPatches(
  fieldKey: string,
  value: string,
  arrayIndex: number | undefined,
  arrayAppend: boolean,
  thumbnailValue: string | undefined,
  getCurrentMeta: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  // Spezialfall: coverImageUrl behält die bestehende Logik mit Thumbnail
  if (fieldKey === 'coverImageUrl') {
    const patches: Record<string, unknown> = { coverImageUrl: value }
    if (thumbnailValue) {
      patches.coverThumbnailUrl = thumbnailValue
    }
    return patches
  }

  // Array-Feld mit explizitem Index (z.B. speakers_image_url[0])
  if (arrayIndex !== undefined) {
    const meta = await getCurrentMeta()
    const current = Array.isArray(meta[fieldKey]) ? [...(meta[fieldKey] as string[])] : []
    // Array bei Bedarf verlängern
    while (current.length <= arrayIndex) {
      current.push('')
    }
    current[arrayIndex] = value
    return { [fieldKey]: current }
  }

  // Array-Feld mit Append (z.B. attachments_url)
  if (arrayAppend) {
    const meta = await getCurrentMeta()
    const current = Array.isArray(meta[fieldKey]) ? [...(meta[fieldKey] as string[])] : []
    current.push(value)
    return { [fieldKey]: current }
  }

  // Einfaches String-Feld
  return { [fieldKey]: value }
}
