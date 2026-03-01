/**
 * @fileoverview Sibling-Files API
 *
 * Liefert Medien-Dateien (Bilder, PDFs) aus dem selben Verzeichnis
 * wie die Quelldatei. Wird im Medien-Tab verwendet, um Dateien
 * aus dem Quellverzeichnis einem Medien-Feld zuordnen zu können.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getMediaKind, type MediaKind } from '@/lib/media-types'
import { FileLogger } from '@/lib/debug/logger'

/** Nur diese MediaKinds werden als zuordnungsfähige Medien zurückgegeben */
const ASSIGNABLE_MEDIA_KINDS = new Set<MediaKind>(['image', 'pdf', 'link'])

export interface SiblingFile {
  id: string
  name: string
  size?: number
  mediaKind: MediaKind
  mimeType?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = await request.json() as { sourceId?: string }

    if (!body?.sourceId || typeof body.sourceId !== 'string') {
      return NextResponse.json({ error: 'sourceId ist erforderlich' }, { status: 400 })
    }

    const provider = await getServerProvider(userEmail, libraryId)

    // Quelldatei laden, um parentId zu ermitteln
    const sourceItem = await provider.getItemById(body.sourceId)
    if (!sourceItem) {
      return NextResponse.json({ error: 'Quelldatei nicht gefunden' }, { status: 404 })
    }

    // Alle Dateien im selben Verzeichnis auflisten
    const siblings = await provider.listItemsById(sourceItem.parentId)

    // Nur Medien-Dateien (Bilder, PDFs) zurückgeben, Quelldatei selbst ausschließen
    const mediaFiles: SiblingFile[] = siblings
      .filter(item => {
        if (item.id === body.sourceId) return false
        if (item.type === 'folder') return false
        const kind = getMediaKind(item)
        return ASSIGNABLE_MEDIA_KINDS.has(kind)
      })
      .map(item => ({
        id: item.id,
        name: item.metadata.name,
        size: item.metadata.size,
        mediaKind: getMediaKind(item),
        mimeType: item.metadata.mimeType,
      }))

    FileLogger.info('sibling-files', `${mediaFiles.length} Medien-Dateien im Quellverzeichnis gefunden`, {
      libraryId,
      sourceId: body.sourceId,
      parentId: sourceItem.parentId,
      total: siblings.length,
      media: mediaFiles.length,
    })

    return NextResponse.json({ files: mediaFiles })
  } catch (error) {
    FileLogger.error('sibling-files', 'Fehler beim Laden der Geschwister-Dateien', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    )
  }
}
