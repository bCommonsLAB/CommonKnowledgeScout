/**
 * @fileoverview PDF Test Helpers for Integration Tests
 *
 * @description
 * Hilfsfunktionen für Integrationstests:
 * - Auflisten von PDF-Dateien in einem Library-Ordner
 * - Vorbereiten des Shadow-Twin-Zustands (clean / exists / legacy_markdown_in_parent)
 *   für die verschiedenen Testfälle (insbesondere TC-1.x und TC-2.5).
 *
 * @module integration-tests
 */

import { getServerProvider } from '@/lib/storage/server-provider'
import type { ShadowTwinInitialState } from './test-cases'
import {
  findShadowTwinFolder,
  findShadowTwinMarkdown,
  generateShadowTwinFolderName,
} from '@/lib/storage/shadow-twin'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import type { StorageItem } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { extractFrontmatterBlock } from '@/lib/markdown/frontmatter'

export interface PdfTestFile {
  itemId: string;
  parentId: string;
  name: string;
  mimeType?: string;
}

export interface ListPdfTestFilesArgs {
  userEmail: string;
  libraryId: string;
  folderId: string;
}

export interface PrepareShadowTwinArgs {
  userEmail: string;
  libraryId: string;
  source: PdfTestFile;
  state: ShadowTwinInitialState | undefined;
  /** Ziel-Sprache, Default: 'de' */
  lang?: string;
  /** Optional: Job-ID für Trace-Events (falls verfügbar) */
  jobId?: string;
}

export interface PrepareShadowTwinResult {
  /** true wenn echte Dateien verwendet wurden, false wenn Dummy-Dateien generiert wurden */
  usedRealFiles: boolean;
  /** Details über gefundene/generierte Dateien */
  details: {
    shadowTwinMarkdownFound: boolean;
    shadowTwinMarkdownHasFrontmatter: boolean;
    legacyFileCreated: boolean;
    legacyFileIsReal: boolean;
  };
}

/**
 * Listet alle PDF-Dateien in einem gegebenen Ordner einer Library.
 */
export async function listPdfTestFiles(args: ListPdfTestFilesArgs): Promise<PdfTestFile[]> {
  const { userEmail, libraryId, folderId } = args
  const provider = await getServerProvider(userEmail, libraryId)
  const items = await provider.listItemsById(folderId)
  return items
    .filter(it => {
      if (it.type !== 'file') return false
      const name = String(it.metadata?.name || '')
      const mimeType = String(it.metadata?.mimeType || '')
      return name.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf'
    })
    .map(it => ({
      itemId: it.id,
      parentId: it.parentId,
      name: String(it.metadata?.name || ''),
      mimeType: String(it.metadata?.mimeType || undefined),
    }))
}

async function deleteItemIfExists(
  provider: import('@/lib/storage/types').StorageProvider,
  parentId: string,
  predicate: (item: StorageItem) => boolean
): Promise<void> {
  const items = await provider.listItemsById(parentId)
  const matches = items.filter(predicate)
  for (const it of matches) {
    await provider.deleteItem(it.id)
  }
}

async function ensureShadowTwinFolder(
  provider: import('@/lib/storage/types').StorageProvider,
  parentId: string,
  originalName: string
): Promise<StorageItem> {
  const existing = await findShadowTwinFolder(parentId, originalName, provider)
  if (existing) return existing
  const folderName = generateShadowTwinFolderName(originalName)
  return provider.createFolder(parentId, folderName)
}

/**
 * Bereitet den Shadow-Twin-Zustand für einen Testfall vor.
 *
 * - 'clean': Shadow-Twin-Verzeichnis + bekannte Markdown-Dateien werden entfernt.
 * - 'exists': Nichts wird geändert (es wird angenommen, dass ein vorheriger Test
 *             bereits konsistente Artefakte erzeugt hat).
 * - 'legacy_markdown_in_parent': Shadow-Twin-Verzeichnis existiert, zusätzlich
 *             wird eine transformierte Markdown-Datei im PDF-Ordner erzeugt.
 *             **Wichtig**: Verwendet echte Dateien, wenn vorhanden; generiert nur Dummy-Dateien als Fallback.
 *
 * @returns Informationen darüber, ob echte Dateien verwendet wurden oder Dummy-Dateien generiert wurden
 */
export async function prepareShadowTwinForTestCase(args: PrepareShadowTwinArgs): Promise<PrepareShadowTwinResult | undefined> {
  const { userEmail, libraryId, source, state, lang: langRaw } = args
  if (!state) return undefined

  const provider = await getServerProvider(userEmail, libraryId)
  const lang = (langRaw && langRaw.trim()) || 'de'
  const baseName = source.name.replace(/\.[^/.]+$/, '')

  if (state === 'clean') {
    // Shadow‑Twin-Verzeichnis löschen, falls vorhanden
    const twinFolder = await findShadowTwinFolder(source.parentId, source.name, provider)
    if (twinFolder) {
      await provider.deleteItem(twinFolder.id)
    }

    // Bekannte Transcript- / Transform-Dateien im Parent entfernen
    await deleteItemIfExists(provider, source.parentId, it => {
      if (it.type !== 'file') return false
      const name = String(it.metadata?.name || '')
      if (!name.toLowerCase().endsWith('.md')) return false
      // Transcript oder transformiert für diese Basisdatei
      // Nutze zentrale buildArtifactName Funktion
      const transcriptKey: ArtifactKey = {
        sourceId: 'test',
        kind: 'transcript',
        targetLanguage: lang,
      }
      const transcriptName = buildArtifactName(transcriptKey, `${baseName}.pdf`)
      // Für Transformation: würde templateName benötigen, hier nur Transcript prüfen
      return name === transcriptName
    })
    return undefined
  }

  if (state === 'exists') {
    // Keine Manipulation – wird typischerweise auf einen vorherigen Lauf (z.B. TC‑1.1) aufbauen.
    return undefined
  }

  if (state === 'legacy_markdown_in_parent') {
    // Nutze zentrale buildArtifactName Funktion für Legacy-Test
    // Für Legacy-Tests verwenden wir Transcript-Format (ohne Template)
    const transcriptKey: ArtifactKey = {
      sourceId: 'test',
      kind: 'transcript',
      targetLanguage: lang,
    }
    const transformedName = buildArtifactName(transcriptKey, `${baseName}.pdf`)
    let usedRealFiles = false
    let shadowTwinMarkdownFound = false
    let shadowTwinMarkdownHasFrontmatter = false
    let legacyFileIsReal = false

    // **SCHRITT 1: Zuerst prüfen, ob bereits eine ECHTE Legacy-Datei neben dem PDF existiert**
    const itemsInParent = await provider.listItemsById(source.parentId)
    const existingLegacyFile = itemsInParent.find(
      it => it.type === 'file' && String(it.metadata?.name || '') === transformedName
    )

    if (existingLegacyFile) {
      // Echte Legacy-Datei gefunden → prüfe Frontmatter
      try {
        const bin = await provider.getBinary(existingLegacyFile.id)
        const text = await bin.blob.text()
        const fmBlock = extractFrontmatterBlock(text)
        const hasFrontmatter = !!fmBlock && fmBlock.length > 0

        FileLogger.info('integration-tests', 'TC-2.5: Echte Legacy-Datei neben PDF gefunden', {
          testCaseId: 'TC-2.5',
          fileName: source.name,
          legacyFileId: existingLegacyFile.id,
          legacyFileName: existingLegacyFile.metadata?.name,
          hasFrontmatter,
        })

        // Echte Datei vorhanden → verwenden, nichts weiter tun
        usedRealFiles = true
        legacyFileIsReal = true

        // Prüfe auch Shadow-Twin-Verzeichnis für Info-Zwecke
        const twinFolder = await findShadowTwinFolder(source.parentId, source.name, provider)
        if (twinFolder) {
          const markdownInTwin = await findShadowTwinMarkdown(twinFolder.id, baseName, lang, provider)
          if (markdownInTwin) {
            shadowTwinMarkdownFound = true
            try {
              const twinBin = await provider.getBinary(markdownInTwin.id)
              const twinText = await twinBin.blob.text()
              const twinFmBlock = extractFrontmatterBlock(twinText)
              shadowTwinMarkdownHasFrontmatter = !!twinFmBlock && twinFmBlock.length > 0
            } catch {
              // Ignoriere Fehler beim Prüfen der Shadow-Twin-Datei
            }
          }
        }

        return {
          usedRealFiles,
          details: {
            shadowTwinMarkdownFound,
            shadowTwinMarkdownHasFrontmatter,
            legacyFileCreated: false, // Nicht erstellt, bereits vorhanden
            legacyFileIsReal,
          },
        }
      } catch (error) {
        FileLogger.error('integration-tests', 'TC-2.5: Fehler beim Prüfen der vorhandenen Legacy-Datei', {
          testCaseId: 'TC-2.5',
          fileName: source.name,
          legacyFileId: existingLegacyFile.id,
          error: error instanceof Error ? error.message : String(error),
        })
        // Fall through zu Schritt 2
      }
    }

    // **SCHRITT 2: Keine echte Legacy-Datei neben PDF gefunden → prüfe Shadow-Twin-Verzeichnis**
    const twinFolder = await ensureShadowTwinFolder(provider, source.parentId, source.name)
    const markdownInTwin = await findShadowTwinMarkdown(twinFolder.id, baseName, lang, provider)
    shadowTwinMarkdownFound = !!markdownInTwin

    if (markdownInTwin) {
      // Prüfe, ob die gefundene Datei Frontmatter hat (echte transformierte Datei)
      try {
        const bin = await provider.getBinary(markdownInTwin.id)
        const text = await bin.blob.text()
        const fmBlock = extractFrontmatterBlock(text)
        shadowTwinMarkdownHasFrontmatter = !!fmBlock && fmBlock.length > 0

        if (shadowTwinMarkdownHasFrontmatter) {
          // Echte Datei mit Frontmatter im Shadow-Twin gefunden → kopiere in PDF-Ordner
          usedRealFiles = true
          legacyFileIsReal = true

          FileLogger.info('integration-tests', 'TC-2.5: Echte Shadow-Twin-Datei mit Frontmatter gefunden, kopiere in PDF-Ordner', {
            testCaseId: 'TC-2.5',
            fileName: source.name,
            shadowTwinFileId: markdownInTwin.id,
            shadowTwinFileName: markdownInTwin.metadata?.name,
            hasFrontmatter: true,
          })

          // Kopiere die echte Datei in den PDF-Ordner
          await deleteItemIfExists(
            provider,
            source.parentId,
            it => it.type === 'file' && String(it.metadata?.name || '') === transformedName
          )

          const binCopy = await provider.getBinary(markdownInTwin.id)
          const legacyFile = new File([binCopy.blob], transformedName, { type: 'text/markdown' })
          await provider.uploadFile(source.parentId, legacyFile)

          return {
            usedRealFiles,
            details: {
              shadowTwinMarkdownFound,
              shadowTwinMarkdownHasFrontmatter,
              legacyFileCreated: true,
              legacyFileIsReal,
            },
          }
        } else {
          FileLogger.warn('integration-tests', 'TC-2.5: Shadow-Twin-Datei ohne Frontmatter gefunden', {
            testCaseId: 'TC-2.5',
            fileName: source.name,
            shadowTwinFileId: markdownInTwin.id,
            shadowTwinFileName: markdownInTwin.metadata?.name,
            hasFrontmatter: false,
          })
        }
      } catch (error) {
        FileLogger.error('integration-tests', 'TC-2.5: Fehler beim Prüfen der Shadow-Twin-Datei', {
          testCaseId: 'TC-2.5',
          fileName: source.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // **SCHRITT 3: Kein weiterer Fallback – nur loggen, keine Dummy-Datei erzeugen**
    // Hintergrund:
    // - Wir wollen TC-2.5 ausschließlich mit echten Daten testen.
    // - Wenn weder im PDF-Ordner noch im Shadow-Twin eine verwertbare Datei mit Frontmatter vorhanden ist,
    //   soll der Test bewusst an den Validierungen scheitern (bzw. als Precondition-Problem sichtbar werden).
    // - Deshalb erzeugen wir hier KEINE Dummy-Dateien mehr, sondern loggen nur die Situation.
    FileLogger.warn('integration-tests', 'TC-2.5: Keine echte Legacy-/Shadow-Twin-Datei mit Frontmatter gefunden – kein Fallback, Test läuft mit echtem Ist-Zustand', {
      testCaseId: 'TC-2.5',
      fileName: source.name,
      reason: shadowTwinMarkdownFound ? 'kein Frontmatter in Shadow-Twin-Datei' : 'keine Shadow-Twin-Datei gefunden',
    })

    return {
      usedRealFiles: false,
      details: {
        shadowTwinMarkdownFound,
        shadowTwinMarkdownHasFrontmatter,
        // keine Datei erzeugt – bewusstes Precondition-Szenario
        legacyFileCreated: false,
        legacyFileIsReal: false,
      },
    }
  }

  return undefined
}


