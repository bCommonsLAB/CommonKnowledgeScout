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
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { deleteShadowTwinBySourceId } from '@/lib/repositories/shadow-twin-repo'

export type IntegrationTestFileKind = 'pdf' | 'audio'

export interface PdfTestFile {
  itemId: string;
  parentId: string;
  name: string;
  mimeType?: string;
}

export interface IntegrationTestFile extends PdfTestFile {
  kind: IntegrationTestFileKind
}

export interface ListPdfTestFilesArgs {
  userEmail: string;
  libraryId: string;
  folderId: string;
}

export interface ListIntegrationTestFilesArgs extends ListPdfTestFilesArgs {
  kind: IntegrationTestFileKind
}

export interface PrepareShadowTwinArgs {
  userEmail: string;
  libraryId: string;
  source: PdfTestFile;
  state: ShadowTwinInitialState | undefined;
  /** Ziel-Sprache, Default: 'de' */
  lang?: string;
  /**
   * Optional: Template-Name für deterministische Artefakt-Namen.
   * Wenn nicht gesetzt, verwenden wir im Test-Setup "pdfanalyse" als Default,
   * damit Exists/Skip/Repair-Szenarien reproduzierbar sind.
   */
  templateName?: string;
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

function detectFileKind(name: string, mimeType: string | undefined): IntegrationTestFileKind | null {
  const n = (name || '').toLowerCase()
  const mt = (mimeType || '').toLowerCase()
  if (n.endsWith('.pdf') || mt === 'application/pdf') return 'pdf'

  // Audio (minimaler Satz, erweiterbar)
  if (mt.startsWith('audio/')) return 'audio'
  if (n.endsWith('.mp3') || n.endsWith('.wav') || n.endsWith('.m4a') || n.endsWith('.aac') || n.endsWith('.ogg') || n.endsWith('.flac')) {
    return 'audio'
  }
  return null
}

/**
 * Listet Testdateien eines bestimmten Typs (pdf/audio) in einem Ordner.
 * Diese Funktion ist für die neue UI ("Dateityp auswählen") gedacht.
 */
export async function listIntegrationTestFiles(args: ListIntegrationTestFilesArgs): Promise<IntegrationTestFile[]> {
  const { userEmail, libraryId, folderId, kind } = args
  const provider = await getServerProvider(userEmail, libraryId)
  const items = await provider.listItemsById(folderId)
  return items
    .filter(it => {
      if (it.type !== 'file') return false
      const name = String(it.metadata?.name || '')
      const mt = typeof it.metadata?.mimeType === 'string' ? String(it.metadata.mimeType) : undefined
      return detectFileKind(name, mt) === kind
    })
    .map(it => {
      const name = String(it.metadata?.name || '')
      const mt = typeof it.metadata?.mimeType === 'string' ? String(it.metadata.mimeType) : undefined
      return {
        itemId: it.id,
        parentId: it.parentId,
        name,
        mimeType: mt,
        kind,
      }
    })
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const templateName = (args.templateName && args.templateName.trim()) || 'pdfanalyse'

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  getShadowTwinConfig(library) // side-effect free; call keeps intent explicit (Config kann null sein)

  function buildDummyTranscriptMarkdown(): string {
    // Kurzer, aber parsebarer Body: die Pages-Rekonstruktion hängt von "--- Seite N ---" Markern ab.
    return [
      '---',
      `lang: ${lang}`,
      '---',
      '',
      '--- Seite 1 ---',
      `Dummy Transcript für Tests (${baseName})`,
      '',
      '--- Seite 2 ---',
      'Ende.',
      '',
    ].join('\n')
  }

  function buildDummyTransformationMarkdown(opts: { complete: boolean }): string {
    // WICHTIG:
    // parseSecretaryMarkdownStrict parsed `chapters` nur, wenn es ein gültiges JSON-Array ist.
    // YAML-Listen (mit "-") würden hier NICHT als Array erkannt → Template-Skip-Logik würde fehlschlagen.
    const chaptersJson = JSON.stringify([
      { title: 'Kapitel 1', startPage: 1 },
      { title: 'Kapitel 2', startPage: 2 },
    ])

    const fmLines = [
      '---',
      `lang: ${lang}`,
      `chapters: ${chaptersJson}`,
    ]
    if (opts.complete) {
      fmLines.push('pages: 2')
    }
    fmLines.push('---', '')

    return [
      ...fmLines,
      '--- Seite 1 ---',
      `Dummy Transformation für Tests (${baseName})`,
      '',
      '--- Seite 2 ---',
      'Ende.',
      '',
    ].join('\n')
  }

  if (state === 'clean') {
    // Mongo: komplettes Shadow‑Twin Dokument löschen (deterministisch).
    // Bei reinen Filesystem-Libraries kann das optional fehlschlagen → nicht kritisch.
    try {
      await deleteShadowTwinBySourceId(libraryId, source.itemId)
    } catch {
      // nicht kritisch für Tests, falls Mongo nicht verfügbar ist
    }

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
      const transcriptName = buildArtifactName(transcriptKey, source.name)
      // Transformation: wir löschen alle Templates, die in der Test-Library typischerweise auftreten
      // (und zusätzlich alles, was mit dieser Basisdatei beginnt).
      return name === transcriptName || name.startsWith(`${baseName}.`) && name.toLowerCase().endsWith(`.${lang}.md`)
    })
    return undefined
  }

  if (state === 'exists') {
    // Deterministisch: Erzeuge Transcript + Transformation mit vollständigem Frontmatter (chapters + pages).
    const service = new ShadowTwinService({
      library,
      userEmail,
      sourceId: source.itemId,
      sourceName: source.name,
      parentId: source.parentId,
      provider,
    })

    await service.upsertMarkdown({
      kind: 'transcript',
      targetLanguage: lang,
      markdown: buildDummyTranscriptMarkdown(),
    })

    await service.upsertMarkdown({
      kind: 'transformation',
      targetLanguage: lang,
      templateName,
      markdown: buildDummyTransformationMarkdown({ complete: true }),
    })

    return undefined
  }

  if (state === 'incomplete_frontmatter') {
    // Deterministisch: Transformation existiert und hat chapters, aber pages fehlt.
    // Template-Phase soll dadurch übersprungen werden (chapters vorhanden),
    // aber pages wird aus dem Body rekonstruiert (Repair).
    const service = new ShadowTwinService({
      library,
      userEmail,
      sourceId: source.itemId,
      sourceName: source.name,
      parentId: source.parentId,
      provider,
    })

    await service.upsertMarkdown({
      kind: 'transcript',
      targetLanguage: lang,
      markdown: buildDummyTranscriptMarkdown(),
    })

    await service.upsertMarkdown({
      kind: 'transformation',
      targetLanguage: lang,
      templateName,
      markdown: buildDummyTransformationMarkdown({ complete: false }),
    })

    return undefined
  }

  return undefined
}


