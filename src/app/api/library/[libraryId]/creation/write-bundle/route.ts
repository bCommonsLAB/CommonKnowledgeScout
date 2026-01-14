/**
 * @fileoverview Creation Bundle Write API - Schreibt Shadow‑Twin Bundle für Creation-Wizard
 * 
 * @description
 * API-Route zum Schreiben des Shadow‑Twin Bundles nach dem Speichern der Source-Datei.
 * Schreibt:
 * - sources.json (Index aller Rohquellen)
 * - Transcript-Artefakt (vollständiger Rohkorpus)
 * - Transformation-Artefakt (Template-Output)
 * 
 * @module creation
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer'
import type { WizardSource } from '@/lib/creation/corpus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface WriteBundleRequest {
  /** ID der Source-Datei (nach Upload) */
  sourceFileId: string
  /** Vollständiger Dateiname der Source-Datei */
  sourceFileName: string
  /** Parent-ID der Source-Datei */
  sourceParentId: string
  /** Liste aller Rohquellen */
  sources: WizardSource[]
  /** Transcript-Inhalt (vollständiger Rohkorpus) */
  transcriptContent: string
  /** Transformation-Inhalt (Template-Output mit Frontmatter) */
  transformationContent: string
  /** Template-Name für Transformation-Artefakt */
  templateName: string
  /** Zielsprache (Default: 'de') */
  targetLanguage?: string
}

/**
 * POST /api/library/[libraryId]/creation/write-bundle
 * 
 * Schreibt Shadow‑Twin Bundle für eine Creation-Datei.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    
    // Authentifizierung
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      )
    }

    // Library validieren (best-effort):
    // In manchen Setups existiert der Storage (Client) auch dann, wenn die Library serverseitig
    // nicht (mehr) in Mongo gefunden wird. Das Bundle ist optional → dann sauber skippen,
    // damit "Speichern" nicht als Fehler wirkt.
    try {
      const libraryService = LibraryService.getInstance()
      const library = await libraryService.getLibrary(userEmail, libraryId)
      if (!library) {
        return NextResponse.json(
          { success: false, skipped: true, reason: 'library_not_found' },
          { status: 200 }
        )
      }
    } catch {
      return NextResponse.json(
        { success: false, skipped: true, reason: 'library_not_found' },
        { status: 200 }
      )
    }

    // Request Body parsen
    const body: WriteBundleRequest = await request.json()
    const {
      sourceFileId,
      sourceFileName,
      sourceParentId,
      sources: sourcesRaw,
      transcriptContent,
      transformationContent,
      templateName,
      targetLanguage = 'de',
    } = body

    // Deserialisiere sources: ISO-Strings zurück zu Date-Objekten
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sources: WizardSource[] = (sourcesRaw || []).map((source: unknown) => {
      if (source && typeof source === 'object') {
        const s = source as Record<string, unknown>
        return {
          ...s,
          createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt) : new Date(),
        } as WizardSource
      }
      return source as WizardSource
    })

    // Validierung
    if (!sourceFileId || !sourceFileName || !sourceParentId) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceFileId, sourceFileName, sourceParentId' },
        { status: 400 }
      )
    }

    if (!transcriptContent && !transformationContent) {
      return NextResponse.json(
        { error: 'At least one of transcriptContent or transformationContent must be provided' },
        { status: 400 }
      )
    }

    // Server-Provider erstellen (best-effort)
    let provider: Awaited<ReturnType<typeof getServerProvider>>
    try {
      provider = await getServerProvider(userEmail, libraryId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('library nicht gefunden') || msg.toLowerCase().includes('library not found')) {
        return NextResponse.json(
          { success: false, skipped: true, reason: 'library_not_found' },
          { status: 200 }
        )
      }
      throw e
    }

    // v2-only: kein Mode-Switch. Migration alter Artefakte passiert später.

    // Ergebnisse sammeln
    const results: {
      transcriptFileId?: string
      transformationFileId?: string
      shadowTwinFolderId?: string
    } = {}

    // 1. Schreibe sources.json (Index aller Rohquellen)
    // TODO: Später implementieren, wenn wir sources.json als separates Artefakt wollen
    // Für jetzt: sources werden im Transcript-Artefakt als Kommentar gespeichert

    // 2. Schreibe Transcript-Artefakt (falls vorhanden)
    if (transcriptContent) {
      const transcriptResult = await writeArtifact(provider, {
        key: {
          sourceId: sourceFileId,
          kind: 'transcript',
          targetLanguage,
        },
        sourceName: sourceFileName,
        parentId: sourceParentId,
        content: transcriptContent,
        createFolder: true, // Erstelle Dot‑Folder für Bundle
      })

      results.transcriptFileId = transcriptResult.file.id
      if (transcriptResult.shadowTwinFolderId) {
        results.shadowTwinFolderId = transcriptResult.shadowTwinFolderId
      }
    }

    // 3. Schreibe Transformation-Artefakt (falls vorhanden)
    if (transformationContent && templateName) {
      const transformationResult = await writeArtifact(provider, {
        key: {
          sourceId: sourceFileId,
          kind: 'transformation',
          targetLanguage,
          templateName,
        },
        sourceName: sourceFileName,
        parentId: sourceParentId,
        content: transformationContent,
        createFolder: true, // Nutze existierenden Dot‑Folder
      })

      results.transformationFileId = transformationResult.file.id
      if (transformationResult.shadowTwinFolderId && !results.shadowTwinFolderId) {
        results.shadowTwinFolderId = transformationResult.shadowTwinFolderId
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('[write-bundle] Fehler:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json(
      {
        error: errorMessage,
        errorStack,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
        } : undefined,
      },
      { status: 500 }
    )
  }
}

