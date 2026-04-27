/**
 * @fileoverview API: PDF-Seiten als Bilder im Arbeitsverzeichnis ablegen
 *
 * @description
 * Folgefunktion zur Mistral-OCR-Transkription. Holt die in der Phase-1-Extraktion
 * bereits erzeugten Seitenrenderings (`pages_archive` -> `page_NNN.png`) aus dem
 * Shadow-Twin (Mongo oder Filesystem) und legt sie als Kopien in einem
 * Working-Verzeichnis neben dem Original-PDF ab.
 *
 * Wichtig: Diese Route fuehrt KEINE neue OCR/Render-Aufgabe aus. Wenn keine
 * Page-Bilder im Shadow-Twin liegen (alte Pipeline ohne Variante-1-Fix), antwortet
 * sie mit 422 + `code='no_page_images'`.
 *
 * Antwortcodes:
 *  - 200: Working-Verzeichnis erstellt/aktualisiert, n Bilder geschrieben.
 *  - 400: libraryId/sourceFileId fehlen oder Quelle ist kein PDF.
 *  - 401: Nicht authentifiziert.
 *  - 404: Quelle nicht gefunden.
 *  - 422: Keine Page-Bilder im Shadow-Twin gefunden (Phase 1 erneut laufen lassen).
 *  - 500: Unerwarteter Fehler.
 *
 * @module api
 *
 * @usedIn
 * - src/components/library/split-pdf-pages-button.tsx
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import path from 'path'

import { FileLogger } from '@/lib/debug/logger'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageItem } from '@/lib/storage/types'
import { toSafeFolderName, splitMarkdownByPageMarkers } from '@/lib/markdown/markdown-page-splitter'
import { locatePageImagesForPdf, NoPageImagesError } from '@/lib/pdf/page-images-locator'
import { deriveSpeakingPageFilename } from '@/lib/pdf/page-filename-heuristic'
// Zentrale Markdown-Lade-Library: deckt Mongo, Filesystem und Lazy-Reconstruction
// einheitlich ab - genau derselbe Pfad, den auch die Preview/Transkript-Tabs nutzen
// (siehe src/components/library/shared/use-resolved-transcript-item.ts ->
//  /api/library/.../artifacts/resolve -> ShadowTwinService.getMarkdown).
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'

interface SplitPagesToImagesRequestBody {
  /** Storage-ID des Original-PDFs. */
  sourceFileId: string
  /** Optionaler Folder-Override; default `<base>-pages`. */
  outputFolderName?: string
  /** Sprache der gesuchten Transcript-Markdown-Datei (fuer Heuristik). Default 'de'. */
  targetLanguage?: string
}

/** Pruefung: ist es ein PDF? Wir akzeptieren MIME oder Datei-Endung. */
function isPdf(name: string, mimeType?: string): boolean {
  if ((mimeType || '').toLowerCase() === 'application/pdf') return true
  return /\.pdf$/i.test(name)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    // 1) Auth
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    const user = await currentUser()
    const userEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      ''
    if (!userEmail) {
      return NextResponse.json({ error: 'Keine Benutzer-E-Mail gefunden' }, { status: 401 })
    }

    // 2) Input
    const { libraryId } = await params
    const body = (await request.json().catch(() => ({}))) as Partial<SplitPagesToImagesRequestBody>
    const sourceFileId = typeof body.sourceFileId === 'string' ? body.sourceFileId : ''
    const outputFolderName = typeof body.outputFolderName === 'string' ? body.outputFolderName : ''
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'

    if (!libraryId || !sourceFileId) {
      return NextResponse.json(
        { error: 'libraryId und sourceFileId sind erforderlich' },
        { status: 400 }
      )
    }

    // 3) StorageProvider initialisieren - liefert die aktive Storage-Konfiguration der Library
    //    (Filesystem ODER Mongo-Backed Provider).
    const provider = await getServerProvider(userEmail, libraryId)

    // 4) PDF-Item laden + Validierung
    const sourceItem = await provider.getItemById(sourceFileId).catch(() => null)
    if (!sourceItem || sourceItem.type !== 'file') {
      return NextResponse.json({ error: 'PDF-Datei nicht gefunden' }, { status: 404 })
    }
    if (!isPdf(sourceItem.metadata.name, sourceItem.metadata.mimeType)) {
      return NextResponse.json(
        { error: 'Quelle ist keine PDF-Datei', detail: sourceItem.metadata.name },
        { status: 400 }
      )
    }

    // 5) Page-Bilder finden (Mongo-First, FS-Fallback). 0 Treffer -> 422.
    let pages: Awaited<ReturnType<typeof locatePageImagesForPdf>>['pages']
    let source: 'mongo' | 'filesystem'
    try {
      const located = await locatePageImagesForPdf({
        libraryId,
        sourceItem,
        provider,
      })
      pages = located.pages
      source = located.source
    } catch (error) {
      if (error instanceof NoPageImagesError) {
        FileLogger.warn('split-pages-to-images', error.message, {
          libraryId,
          sourceId: sourceItem.id,
        })
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 422 }
        )
      }
      throw error
    }

    // 6) Transcript-Markdown laden (fuer sprechende Dateinamen).
    //    Wir nutzen den zentralen ShadowTwinService - identisch zur Preview - und
    //    decken damit Mongo-only, FS-only und Mixed-Mode Libraries einheitlich ab.
    //    Optional: wenn das fehlschlaegt, fallen wir auf reine page_NNN.<ext>-Namen zurueck,
    //    weil das Schreiben der Bilder wichtiger ist als das schmuckhafte Naming.
    const pageMarkdownByNumber = await loadPageMarkdownMap({
      libraryId,
      userEmail,
      sourceItem,
      targetLanguage,
    })

    // 7) Working-Folder finden/erstellen (idempotent neben dem PDF).
    const baseName = path.parse(sourceItem.metadata.name).name
    const requestedFolder = outputFolderName.trim() || `${baseName}-pages`
    const folderName = toSafeFolderName(requestedFolder)
    const parentId = sourceItem.parentId || 'root'
    const siblings = await provider.listItemsById(parentId)
    const existingFolder = siblings.find(
      (it) => it.type === 'folder' && (it.metadata?.name || '') === folderName
    )
    const targetFolder = existingFolder || (await provider.createFolder(parentId, folderName))

    // 8) Bilder ablegen. Existierende gleichnamige Dateien werden uebersprungen.
    const existingTargetItems = await provider.listItemsById(targetFolder.id)
    const existingNames = new Set(
      existingTargetItems
        .filter((it) => it.type === 'file')
        .map((it) => (it.metadata?.name || '').toLowerCase())
    )

    let createdCount = 0
    let skippedCount = 0
    let suffixedCount = 0
    let unsuffixedCount = 0
    const errors: Array<{ pageNumber: number; error: string }> = []

    for (const page of pages) {
      try {
        // Extension aus dem MIME-Type oder Original-Dateinamen ableiten.
        const ext = pickExtension(page.mimeType, page.fileName)
        const speakingMarkdown = pageMarkdownByNumber.get(page.pageNumber) || ''
        const fileName = deriveSpeakingPageFilename({
          pageNumber: page.pageNumber,
          pageMarkdown: speakingMarkdown,
          imageExtension: ext,
        })

        // Diagnose pro Seite: hat die Heuristik einen Suffix erzeugt?
        // Suffix-Erkennung ueber den Filename: page_NNN.<ext> ohne `__`.
        const hasSpeakingSuffix = fileName.includes('__')
        if (hasSpeakingSuffix) suffixedCount += 1
        else unsuffixedCount += 1
        FileLogger.debug('split-pages-to-images', 'Filename-Heuristik fuer Seite', {
          pageNumber: page.pageNumber,
          markdownLength: speakingMarkdown.length,
          markdownPreview: speakingMarkdown.slice(0, 120),
          producedFileName: fileName,
          hasSpeakingSuffix,
        })

        if (existingNames.has(fileName.toLowerCase())) {
          skippedCount += 1
          continue
        }

        // Blob -> File. WICHTIG: type setzen, damit Provider-Implementierungen den Mime erkennen.
        const file = new File([page.blob], fileName, { type: page.mimeType })
        await provider.uploadFile(targetFolder.id, file)
        createdCount += 1
      } catch (error) {
        errors.push({
          pageNumber: page.pageNumber,
          error: error instanceof Error ? error.message : String(error),
        })
        FileLogger.warn('split-pages-to-images', 'Fehler beim Speichern einer Seite', {
          libraryId,
          sourceId: sourceItem.id,
          page: page.pageNumber,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Zusammenfassung: wie viele Seiten haben einen sprechenden Suffix bekommen?
    // Nuetzlich fuer den Anwender, um schnell zu erkennen, ob die Heuristik gegriffen hat.
    FileLogger.info('split-pages-to-images', 'Filename-Heuristik Zusammenfassung', {
      libraryId,
      sourceId: sourceItem.id,
      totalPages: pages.length,
      suffixedCount,
      unsuffixedCount,
      pageMarkdownMapSize: pageMarkdownByNumber.size,
    })

    // 9) Antwort - Anzahl, Quelle, Ordner-ID. Toast im Frontend nutzt das fuer "X von Y geschrieben".
    return NextResponse.json({
      ok: true,
      folderId: targetFolder.id,
      folderName: targetFolder.metadata.name,
      pages: pages.length,
      created: createdCount,
      skipped: skippedCount,
      errors: errors.length,
      source,
      suffixed: suffixedCount,
      unsuffixed: unsuffixedCount,
    })
  } catch (error) {
    FileLogger.error('split-pages-to-images', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

/**
 * Liefert eine Map "pageNumber -> markdown der Seite", die fuer die sprechende
 * Dateibenennung im Working-Folder genutzt wird.
 *
 * Wir nutzen hier bewusst den ZENTRALEN Lade-Pfad ueber `ShadowTwinService.getMarkdown`,
 * der intern Mongo-Primary -> Filesystem-Fallback (oder umgekehrt) deckt und Lazy-
 * Reconstruction unterstuetzt. Das ist genau derselbe Pfad, den auch die Preview-
 * /Transkript-Tabs in der UI nutzen (ueber /api/library/.../artifacts/resolve).
 *
 * Frueher: direkter `resolveArtifact + provider.getBinary` Aufruf -> hat das
 * Markdown in Mongo-only Libraries verfehlt.
 *
 * Schlaegt das Laden fehl, geben wir eine leere Map zurueck (-> Fallback auf reine
 * page_NNN.<ext>-Namen). Das Schreiben der Bilder ist wichtiger als das Naming.
 */
async function loadPageMarkdownMap(args: {
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  targetLanguage: string
}): Promise<Map<number, string>> {
  const { libraryId, userEmail, sourceItem, targetLanguage } = args
  if (!sourceItem) return new Map()
  try {
    // Library laden - benoetigt fuer Mode-Detection (primaryStore=mongo|filesystem).
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      FileLogger.warn('split-pages-to-images', 'Library nicht gefunden - kein Transcript-Lookup moeglich', {
        libraryId,
        userEmail,
      })
      return new Map()
    }

    const service = await ShadowTwinService.create({
      library,
      userEmail,
      sourceId: sourceItem.id,
      sourceName: sourceItem.metadata.name,
      parentId: sourceItem.parentId || 'root',
    })

    // Zentraler Lookup: Mongo -> FS (oder umgekehrt) -> Lazy Reconstruction.
    const result = await service.getMarkdown({
      kind: 'transcript',
      targetLanguage,
    })

    if (!result || !result.markdown) {
      FileLogger.warn(
        'split-pages-to-images',
        'Kein Transcript ueber ShadowTwinService gefunden - sprechende Dateinamen entfallen',
        {
          sourceId: sourceItem.id,
          sourceName: sourceItem.metadata.name,
          targetLanguage,
        }
      )
      return new Map()
    }

    const split = splitMarkdownByPageMarkers(result.markdown)

    // Diagnose-Log: zeigt, ob der Page-Splitter die "--- Seite N ---"-Marker
    // (oder Em-/En-Dash-Varianten) gefunden hat. markerCount=0 -> kein Splitting,
    // Heuristik kann dann nicht greifen, weil die Seitenzuordnung fehlt.
    FileLogger.info(
      'split-pages-to-images',
      'Transcript-Markdown geladen (zentrale Library) und gesplittet',
      {
        sourceId: sourceItem.id,
        transcriptId: result.id,
        transcriptName: result.name,
        markdownLength: result.markdown.length,
        markerCount: split.markerCount,
        pageNumbers: split.pages.map((p) => p.pageNumber),
        markdownPreview: result.markdown.slice(0, 200),
      }
    )

    const map = new Map<number, string>()
    for (const page of split.pages) {
      map.set(page.pageNumber, page.content)
    }
    return map
  } catch (error) {
    FileLogger.warn(
      'split-pages-to-images',
      'Konnte Transcript-Markdown nicht laden - sprechende Dateinamen werden uebersprungen',
      {
        error: error instanceof Error ? error.message : String(error),
      }
    )
    return new Map()
  }
}

/** Bestimmt die Ziel-Extension fuer das Bild (png/jpeg) - bevorzugt MIME-Type, sonst Dateiname. */
function pickExtension(mimeType: string, fileName: string): 'png' | 'jpeg' {
  const mt = (mimeType || '').toLowerCase()
  if (mt === 'image/png') return 'png'
  if (mt === 'image/jpeg' || mt === 'image/jpg') return 'jpeg'
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext === 'png') return 'png'
  return 'jpeg'
}
