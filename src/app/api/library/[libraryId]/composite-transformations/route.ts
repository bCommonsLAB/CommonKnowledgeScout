/**
 * @fileoverview API-Route fuer Sammel-Transformations-Erstellung
 *
 * Erzeugt eine `composite-transcript`-Markdown-Datei, deren `_source_files`-
 * Eintraege und Wikilinks ein `/templateName`-Suffix tragen, sodass der
 * bestehende Resolver pro Quelle die entsprechende Transformation laedt
 * (statt eines Transcripts).
 *
 * - GET  ?sourceIds=…&targetLanguage=…  → liefert verfuegbare Templates fuer den Dialog
 * - POST sourceItems + templateName + filename → persistiert die Sammel-Datei
 *
 * Hinweis: Die erzeugte Datei nutzt KEIN neues `kind`. Sie laeuft durch den
 * normalen Composite-Transcript-Pipeline-Pfad in `start/route.ts`.
 *
 * @see src/lib/creation/composite-transcript.ts
 * @see src/lib/creation/composite-transformations-pool.ts
 * @see .cursor/rules/shadow-twin-contracts.mdc (templateName-Pflicht)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { buildCompositeReference } from '@/lib/creation/composite-transcript'
import { findCommonTemplatesForSources } from '@/lib/creation/composite-transformations-pool'
import { FileLogger } from '@/lib/debug/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST-Request-Body. */
interface CompositeTransformationsRequest {
  /** Markierte Quellen — ALLE muessen die gewaehlte Transformation besitzen. */
  sourceItems: Array<{ id: string; name: string; parentId: string }>
  /** Template-Name (z.B. `gaderform-bett-steckbrief`). Pflicht. */
  templateName: string
  /** Optional, default `'de'`. */
  targetLanguage?: string
  /** Vom UI-Dialog gewaehlter Dateiname (mit oder ohne `.md`-Endung). */
  filename: string
  /** Optionaler Titel als H1 im Markdown-Body. Aktuell nur fuer Anzeige im Dialog vorgesehen. */
  title?: string
}

/**
 * Filename-Validierung: keine Pfad-Trenner, keine Steuerzeichen, max. 200 Zeichen.
 * Endung `.md` wird ergaenzt, wenn nicht vorhanden.
 */
function validateAndNormalizeFilename(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 200) return null
  if (/[\\/:*?"<>|\x00-\x1f]/.test(trimmed)) return null
  if (trimmed.toLowerCase().endsWith('.md')) return trimmed
  if (trimmed.includes('.')) return null
  return `${trimmed}.md`
}

/**
 * GET: Liefert die fuer eine Quellen-Selektion verfuegbaren Templates.
 *
 * Query-Parameter:
 * - `sourceIds`: kommaseparierte Liste der Storage-Item-IDs
 * - `sourceNames`: kommaseparierte Liste der Dateinamen (gleiche Reihenfolge wie sourceIds)
 * - `targetLanguage`: optional, default `'de'`
 *
 * Wir uebergeben die Dateinamen explizit, damit der Caller schon im UI weiss,
 * welcher Display-Name zu welcher ID gehoert. So muss die Route nicht zusaetzlich
 * den Provider lesen.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const url = new URL(request.url)
    const sourceIdsRaw = url.searchParams.get('sourceIds') || ''
    const sourceNamesRaw = url.searchParams.get('sourceNames') || ''
    const targetLanguage = (url.searchParams.get('targetLanguage') || 'de').trim() || 'de'

    const sourceIds = sourceIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
    const sourceNames = sourceNamesRaw.split(',').map(s => s.trim()).filter(Boolean)

    if (sourceIds.length === 0) {
      return NextResponse.json({ error: 'sourceIds fehlt' }, { status: 400 })
    }

    if (sourceNames.length !== sourceIds.length) {
      return NextResponse.json(
        { error: 'sourceNames muss die gleiche Anzahl wie sourceIds haben' },
        { status: 400 },
      )
    }

    const sourceNamesById: Record<string, string> = {}
    for (let i = 0; i < sourceIds.length; i++) {
      sourceNamesById[sourceIds[i]] = sourceNames[i]
    }

    const result = await findCommonTemplatesForSources({
      libraryId,
      sourceIds,
      sourceNamesById,
      targetLanguage,
    })

    return NextResponse.json({
      success: true,
      targetLanguage,
      ...result,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('composite-transformations/api', 'GET fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST: Persistiert eine Sammel-Transformations-Datei im Verzeichnis der Quellen.
 *
 * Validierungen (in dieser Reihenfolge):
 *  1. Auth + Library
 *  2. >= 2 Quellen, gleicher parentId
 *  3. templateName + filename gesetzt + valide
 *  4. Pool-Lookup: ALLE Quellen muessen das Template + die Sprache besitzen.
 *     Falls nicht: 400 mit `missingSources`-Liste.
 *  5. Filename-Kollisionscheck: 409, wenn Datei mit dem Namen existiert
 *  6. Persistierung via `provider.uploadFile`
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const body = (await request.json()) as Partial<CompositeTransformationsRequest>
    const sourceItems = Array.isArray(body.sourceItems) ? body.sourceItems : []
    const rawFilename = typeof body.filename === 'string' ? body.filename : ''
    const templateName = typeof body.templateName === 'string' ? body.templateName.trim() : ''
    const targetLanguage = typeof body.targetLanguage === 'string' && body.targetLanguage.trim()
      ? body.targetLanguage.trim()
      : 'de'

    // 1. Mindestanzahl Quellen
    if (sourceItems.length < 2) {
      return NextResponse.json(
        { error: 'Mindestens 2 Quellen erforderlich' },
        { status: 400 },
      )
    }

    // 2. parentId muss gesetzt und einheitlich sein
    const parentIds = new Set(sourceItems.map(s => s?.parentId).filter(Boolean))
    if (parentIds.size !== 1) {
      return NextResponse.json(
        { error: 'Alle Quellen muessen im selben Verzeichnis liegen' },
        { status: 400 },
      )
    }
    const parentId = sourceItems[0].parentId

    // 3. templateName Pflicht
    if (!templateName) {
      return NextResponse.json(
        { error: 'templateName ist Pflicht (siehe shadow-twin-contracts.mdc)' },
        { status: 400 },
      )
    }

    // 4. Pool-Lookup: Template muss fuer alle Quellen existieren
    const sourceIds = sourceItems.map(s => s.id)
    const sourceNamesById: Record<string, string> = {}
    for (const item of sourceItems) {
      sourceNamesById[item.id] = item.name
    }
    const pool = await findCommonTemplatesForSources({
      libraryId,
      sourceIds,
      sourceNamesById,
      targetLanguage,
    })
    const entry = pool.templates.find(t => t.templateName === templateName)
    if (!entry) {
      return NextResponse.json(
        {
          error: `Template "${templateName}" fuer Sprache "${targetLanguage}" bei keiner der Quellen vorhanden`,
          availableTemplates: pool.templates.map(t => t.templateName),
        },
        { status: 400 },
      )
    }
    if (entry.missingSources.length > 0) {
      return NextResponse.json(
        {
          error: `Template "${templateName}" fehlt bei ${entry.missingSources.length} von ${sourceIds.length} Quellen`,
          missingSources: entry.missingSources,
        },
        { status: 400 },
      )
    }

    // 5. Filename
    const filename = validateAndNormalizeFilename(rawFilename)
    if (!filename) {
      return NextResponse.json(
        {
          error:
            'Ungueltiger Dateiname (keine Pfad-Trenner; Endung .md optional, andere Endungen verboten)',
        },
        { status: 400 },
      )
    }

    // 6. Build + Persistierung
    const buildResult = await buildCompositeReference({
      libraryId,
      userEmail,
      targetLanguage,
      sourceItems,
      library,
      transformationTemplateName: templateName,
    })

    const provider = await getServerProvider(userEmail, libraryId)
    let siblings
    try {
      siblings = await provider.listItemsById(parentId)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      FileLogger.error('composite-transformations/api', 'listItemsById fehlgeschlagen', {
        libraryId,
        parentId,
        error: msg,
      })
      return NextResponse.json({ error: `Verzeichnis nicht lesbar: ${msg}` }, { status: 500 })
    }

    const collision = siblings.find(s => s.type === 'file' && s.metadata.name === filename)
    if (collision) {
      return NextResponse.json(
        {
          error: `Datei "${filename}" existiert bereits im Verzeichnis`,
          existingFileId: collision.id,
        },
        { status: 409 },
      )
    }

    const blob = new Blob([buildResult.markdown], { type: 'text/markdown' })
    const file = new File([blob], filename, { type: 'text/markdown' })
    const savedItem = await provider.uploadFile(parentId, file)

    FileLogger.info('composite-transformations/api', 'Sammel-Transformations gespeichert', {
      libraryId,
      filename,
      parentId,
      savedItemId: savedItem.id,
      templateName,
      targetLanguage,
      sourceCount: sourceItems.length,
    })

    return NextResponse.json({
      success: true,
      file: {
        id: savedItem.id,
        name: savedItem.metadata.name,
        parentId,
      },
      templateName,
      targetLanguage,
      sourceFileNames: buildResult.sourceFileNames,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('composite-transformations/api', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
