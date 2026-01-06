/**
 * @fileoverview PDF Test Helpers for Integration Tests
 *
 * @description
 * Hilfsfunktionen für Integrationstests:
 * - Auflisten von PDF-Dateien in einem Library-Ordner
 * - Vorbereiten des Shadow-Twin-Zustands (clean / exists / incomplete_frontmatter)
 *
 * @module integration-tests
 */

import { getServerProvider } from '@/lib/storage/server-provider'
import type { ShadowTwinInitialState } from './test-cases'
import {
  findShadowTwinFolder,
  generateShadowTwinFolderName,
} from '@/lib/storage/shadow-twin'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import type { StorageItem } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'

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

  return undefined
}


