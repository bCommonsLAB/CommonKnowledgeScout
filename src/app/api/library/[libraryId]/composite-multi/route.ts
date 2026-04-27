/**
 * @fileoverview API-Route für Bild-Sammelanalyse-Erstellung (composite-multi)
 *
 * Nimmt mehrere Bild-Quell-IDs entgegen, erzeugt ein leichtgewichtiges
 * Composite-Multi-Markdown mit Frontmatter `kind: composite-multi` und
 * Obsidian-Embeds und speichert es im selben Verzeichnis wie die Quellen.
 *
 * Im Gegensatz zur composite-transcript-Route:
 * - Ausschließlich Bild-Quellen (Validierung in `buildCompositeMultiReference`)
 * - Hartes Limit 2..10 Quellen (Secretary-Spec)
 * - Filename kommt vom UI (Dialog-Input), nicht automatisch
 * - Kollisions-Check: 409, wenn Datei mit dem Namen existiert
 *
 * POST /api/library/[libraryId]/composite-multi
 *
 * @see src/lib/creation/composite-multi.ts
 * @see docs/_secretary-service-docu/image-analyzer.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import {
  buildCompositeMultiReference,
  COMPOSITE_MULTI_MIN_IMAGES,
  COMPOSITE_MULTI_MAX_IMAGES,
} from '@/lib/creation/composite-multi'
import { isImageMediaFromName } from '@/lib/media-types'
import { FileLogger } from '@/lib/debug/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CompositeMultiRequest {
  /** Ausgewählte Bild-Quellen mit id, name und parentId. Reihenfolge wird beibehalten. */
  sourceItems: Array<{ id: string; name: string; parentId: string }>
  /** Vom UI-Dialog gewählter Dateiname (mit oder ohne `.md`-Endung). */
  filename: string
  /** Optionaler Titel als H1 im Markdown-Body. */
  title?: string
}

/**
 * Strenge Filename-Validierung: nur sichere ASCII-Zeichen + Umlaute, keine
 * Pfad-Trenner, keine Steuerzeichen. Endung `.md` ist optional und wird
 * automatisch ergänzt.
 */
function validateAndNormalizeFilename(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 200) return null
  // Pfad-Trenner und gefährliche Zeichen ausschließen.
  if (/[\\/:*?"<>|\x00-\x1f]/.test(trimmed)) return null
  // Wenn keine Endung gesetzt, `.md` ergänzen. Wenn andere Endung, ablehnen.
  if (trimmed.toLowerCase().endsWith('.md')) return trimmed
  if (trimmed.includes('.')) return null
  return `${trimmed}.md`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // Authentifizierung
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Library validieren
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Body parsen
    const body = (await request.json()) as Partial<CompositeMultiRequest>
    const sourceItems = Array.isArray(body.sourceItems) ? body.sourceItems : []
    const rawFilename = typeof body.filename === 'string' ? body.filename : ''
    const title = typeof body.title === 'string' ? body.title : undefined

    // Validierung 1: Anzahl Quellen
    if (sourceItems.length < COMPOSITE_MULTI_MIN_IMAGES) {
      return NextResponse.json(
        {
          error: `Mindestens ${COMPOSITE_MULTI_MIN_IMAGES} Bilder erforderlich`,
        },
        { status: 400 }
      )
    }
    if (sourceItems.length > COMPOSITE_MULTI_MAX_IMAGES) {
      return NextResponse.json(
        {
          error: `Maximal ${COMPOSITE_MULTI_MAX_IMAGES} Bilder erlaubt (Secretary-Limit)`,
        },
        { status: 400 }
      )
    }

    // Validierung 2: Alle Quellen müssen Bilder sein.
    // Doppelte Validierung (auch im Build-Helper), aber sie liefert hier eine
    // saubere 400-Antwort statt eines generischen 500-Fehlers.
    const nonImage = sourceItems.filter(s => !s?.name || !isImageMediaFromName(s.name))
    if (nonImage.length > 0) {
      return NextResponse.json(
        {
          error: `Nur Bild-Quellen erlaubt. Nicht-Bild-Dateien: ${nonImage.map(s => s?.name || '?').join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Validierung 3: parentId muss bei allen Quellen gesetzt sein und gleich sein.
    // Composite-MD wird im selben Verzeichnis wie die Quellen abgelegt;
    // gemischte Verzeichnisse machen das Wiki-Embed-Konzept brüchig.
    const parentIds = new Set(sourceItems.map(s => s?.parentId).filter(Boolean))
    if (parentIds.size !== 1) {
      return NextResponse.json(
        {
          error: 'Alle Quellen müssen im selben Verzeichnis liegen',
        },
        { status: 400 }
      )
    }
    const parentId = sourceItems[0].parentId

    // Validierung 4: Filename
    const filename = validateAndNormalizeFilename(rawFilename)
    if (!filename) {
      return NextResponse.json(
        {
          error: 'Ungültiger Dateiname (nur Buchstaben/Zahlen/Bindestriche/Unterstriche, keine Pfad-Trenner; Endung .md optional)',
        },
        { status: 400 }
      )
    }

    // Composite-Multi-Markdown erzeugen (validiert intern noch einmal Bild-Quellen)
    let compositeResult
    try {
      compositeResult = buildCompositeMultiReference({
        libraryId,
        sourceItems,
        title,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Provider holen und Kollisions-Check
    const provider = await getServerProvider(userEmail, libraryId)
    let siblings
    try {
      siblings = await provider.listItemsById(parentId)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      FileLogger.error('composite-multi/api', 'listItemsById fehlgeschlagen', { libraryId, parentId, error: msg })
      return NextResponse.json({ error: `Verzeichnis nicht lesbar: ${msg}` }, { status: 500 })
    }

    const collision = siblings.find(s => s.type === 'file' && s.metadata.name === filename)
    if (collision) {
      return NextResponse.json(
        {
          error: `Datei "${filename}" existiert bereits im Verzeichnis`,
          existingFileId: collision.id,
        },
        { status: 409 }
      )
    }

    // Persistieren
    const blob = new Blob([compositeResult.markdown], { type: 'text/markdown' })
    const file = new File([blob], filename, { type: 'text/markdown' })
    const savedItem = await provider.uploadFile(parentId, file)

    FileLogger.info('composite-multi/api', 'Composite-Multi gespeichert', {
      libraryId,
      filename,
      parentId,
      savedItemId: savedItem.id,
      sourceCount: sourceItems.length,
    })

    return NextResponse.json({
      success: true,
      file: {
        id: savedItem.id,
        name: savedItem.metadata.name,
        parentId,
      },
      sourceFileNames: compositeResult.sourceFileNames,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('composite-multi/api', 'Unerwarteter Fehler', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
