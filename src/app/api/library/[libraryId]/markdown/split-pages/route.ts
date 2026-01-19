import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import path from 'path'

import { FileLogger } from '@/lib/debug/logger'
import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import {
  splitMarkdownByPageMarkers,
  toSafeFolderName,
} from '@/lib/markdown/markdown-page-splitter'

interface SplitPagesRequestBody {
  sourceFileId: string
  originalFileId?: string
  targetLanguage?: string
  outputFolderName?: string
}

interface SplitPagesError {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
}

function createSplitError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): SplitPagesError {
  return { code, message, status, details }
}

function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdx')
}

function isMarkdownMimeType(mimeType: string | undefined): boolean {
  return (mimeType || '').toLowerCase().includes('markdown')
}

function buildPageFrontmatter(args: {
  sourceFileId: string
  sourceFileName: string
  pageNumber: number
  totalPages: number
}): string {
  // Dokumentiert: Wir fügen die Herkunft explizit hinzu, damit Explorer-Filter stabil bleiben.
  return [
    '---',
    `source_file_id: ${args.sourceFileId}`,
    `source_file_name: ${JSON.stringify(args.sourceFileName)}`,
    `page: ${args.pageNumber}`,
    `pages_total: ${args.totalPages}`,
    '---',
    '',
  ].join('\n')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Keine Benutzer-E-Mail gefunden' }, { status: 401 })

    const { libraryId } = await params
    const body = (await request.json().catch(() => ({}))) as Partial<SplitPagesRequestBody>
    const sourceFileId = typeof body.sourceFileId === 'string' ? body.sourceFileId : ''
    const originalFileId = typeof body.originalFileId === 'string' ? body.originalFileId : sourceFileId
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    const outputFolderName = typeof body.outputFolderName === 'string' ? body.outputFolderName : ''

    if (!libraryId || !sourceFileId) {
      return NextResponse.json({ error: 'libraryId und sourceFileId erforderlich' }, { status: 400 })
    }

    // Storage-Provider initialisieren (inkl. Base-URL + User-Email)
    const provider = await getServerProvider(userEmail, libraryId)

    // Source-Datei laden (kann Transcript-Datei sein, wenn direkt aufgerufen)
    const sourceItem = await provider.getItemById(sourceFileId)
    if (!sourceItem || sourceItem.type !== 'file') {
      return NextResponse.json({ error: 'Quelle ist keine Datei' }, { status: 400 })
    }

    const sourceFileName = sourceItem.metadata.name
    const sourceBaseName = path.parse(sourceFileName).name

    // Original-Datei laden, um parentId zu kennen (für Verzeichnis-Erstellung neben dem Original)
    const originalItem = originalFileId !== sourceFileId 
      ? await provider.getItemById(originalFileId).catch(() => null)
      : sourceItem
    if (!originalItem || originalItem.type !== 'file') {
      return NextResponse.json({ error: 'Original-Datei nicht gefunden' }, { status: 400 })
    }

    // parentId vom Original verwenden, damit das Verzeichnis neben dem Original erstellt wird
    const parentId = originalItem.parentId || 'root'

    // 1) Wenn die Quelle schon Markdown ist: direkt verwenden
    // 2) Sonst: Transcript per Shadow‑Twin Resolver suchen (Marker sind dort verlässlich)
    //    Verwende originalFileId für die Suche, falls sourceFileId bereits die Transcript-Datei ist
    const resolvedMarkdown = isMarkdownFileName(sourceFileName) || isMarkdownMimeType(sourceItem.metadata.mimeType)
      ? { fileId: sourceFileId }
      : await resolveArtifact(provider, {
          sourceItemId: originalFileId,
          sourceName: originalItem.metadata.name,
          parentId: originalItem.parentId || 'root',
          targetLanguage,
          preferredKind: 'transcript',
        })

    if (!resolvedMarkdown?.fileId) {
      return NextResponse.json(
        { error: 'Transcript-Markdown nicht gefunden (kein Split möglich)' },
        { status: 404 }
      )
    }

    // Markdown laden
    const markdownBinary = await provider.getBinary(resolvedMarkdown.fileId)
    const markdown = await markdownBinary.blob.text()

    // Seiten splitten (harte Validierung: ohne Marker keine Ausgabe)
    const splitResult = splitMarkdownByPageMarkers(markdown)
    if (splitResult.pages.length === 0) {
      const splitError = createSplitError(
        'no_page_markers',
        'Keine Seitenmarker gefunden (Format: "--- Seite N ---")',
        422,
        { markerCount: splitResult.markerCount }
      )
      FileLogger.warn('split-pages', splitError.message, splitError.details)
      return NextResponse.json({ error: splitError.message, code: splitError.code }, { status: splitError.status })
    }

    // Zielordner finden oder erstellen
    const requestedFolder = outputFolderName.trim() || sourceBaseName
    const folderName = toSafeFolderName(requestedFolder)
    const siblings = await provider.listItemsById(parentId)
    const existingFolder = siblings.find(
      (it) => it.type === 'folder' && (it.metadata?.name || '') === folderName
    )
    const targetFolder = existingFolder || (await provider.createFolder(parentId, folderName))

    // Seiten als einzelne Markdown-Dateien speichern
    let createdCount = 0
    for (const page of splitResult.pages) {
      try {
        // Erklärung: deterministischer Dateiname für stabile Batch-Auswahl
        const padded = String(page.pageNumber).padStart(3, '0')
        const fileName = `page-${padded}.md`
        const frontmatter = buildPageFrontmatter({
          sourceFileId,
          sourceFileName,
          pageNumber: page.pageNumber,
          totalPages: splitResult.pages.length,
        })
        const content = `${frontmatter}${page.content.trim()}\n`
        const file = new File([content], fileName, { type: 'text/markdown' })
        await provider.uploadFile(targetFolder.id, file)
        createdCount += 1
      } catch (error) {
        // Fehler dokumentieren, aber den Split nicht komplett abbrechen (teilweise Ergebnisse sind erlaubt)
        FileLogger.error('split-pages', 'Fehler beim Speichern einer Seite', {
          sourceFileId,
          page: page.pageNumber,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      folderId: targetFolder.id,
      folderName: targetFolder.metadata.name,
      created: createdCount,
      pages: splitResult.pages.length,
      sourceMarkdownId: resolvedMarkdown.fileId,
    })
  } catch (error) {
    FileLogger.error('split-pages', 'Unerwarteter Fehler beim Splitten', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
