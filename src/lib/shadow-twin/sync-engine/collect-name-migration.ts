/**
 * @fileoverview Collect-Schicht der Namens-Migration (Welle 5c).
 *
 * @description
 * Liefert den Input fuer {@link planNameMigration} auf beiden Quell-Pfaden:
 * - Doc-Pfad ({@link classifyTranscriptCandidates}): klassifiziert die bereits
 *   gelesenen Transkript-Kandidaten (kein zusaetzliches I/O). Muster-A-Dateien
 *   (`{base}.{lang}.md` MIT Frontmatter) sind KEINE Transkript-Kandidaten —
 *   sonst wuerde die Reconcile eine Legacy-Transformation als „unterlegene
 *   Variante" loeschen.
 * - Adoptions-Pfad ({@link collectAdoptionNameMigration}): liest gezielt die
 *   legacy-benannten Dateien und die kanonische `{base}.md` (wenige, kleine
 *   Markdown-Dateien) — mehr Inhalt braucht die Klassifikation nicht.
 *
 * Pfadlaengen sind Naeherungen relativ zur Scan-Wurzel; der Twin-Ordner-Name
 * wird ueber {@link generateShadowTwinFolderName} geschaetzt (Varianten
 * unterscheiden sich hoechstens um wenige Zeichen). `null` = unbekannt.
 *
 * @module shadow-twin/sync-engine
 */

import path from 'path'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import type { ReconcileCandidate } from '@/lib/shadow-twin/reconcile-plan'
import type { NameMigrationFileInput, NameMigrationInput } from '@/lib/shadow-twin/sync-plan/plan-name-migration'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

/** Frontmatter-Erkennung der Namens-Migration: erste Zeile ist `---`. */
export function hasLeadingFrontmatter(markdown: string): boolean {
  return /^---\r?\n/.test(markdown)
}

type CollectedNameMigration = Pick<NameMigrationInput, 'legacyNamed' | 'combined' | 'existingFiles'>

/** Library-weite Vorgaben der Namens-Migration (einmal pro Lauf ermittelt). */
export interface NameMigrationContext {
  /** Standard-Template der Library (`config.secretaryService.template`); null = nicht gesetzt. */
  templateName: string | null
  /** Zielsprache fuer Split-Kopien (`config.secretaryService.targetLanguage`, Fallback 'de'). */
  splitTargetLanguage: string
  pathBudget: number
  /** Relative Pfadlaenge des Quell-Ordners aus dem Scan; null = unbekannt (sourceIds-Scope). */
  parentPathLength: number | null
}

/** Kombiniert gesammelte Befunde + Library-Kontext zum Plan-Input. */
export function buildNameMigrationInput(
  sourceBaseName: string,
  collected: CollectedNameMigration,
  ctx: NameMigrationContext,
): NameMigrationInput {
  return {
    sourceBaseName,
    legacyNamed: collected.legacyNamed,
    combined: collected.combined,
    existingFiles: collected.existingFiles,
    templateName: ctx.templateName,
    splitTargetLanguage: ctx.splitTargetLanguage,
    pathBudget: ctx.pathBudget,
  }
}

/** Legacy-Name `{base}.{lang}.md`? (Parser: kind transcript MIT Sprachcode) */
function parseLegacyLanguage(fileName: string, sourceBaseName: string): string | null {
  const parsed = parseArtifactName(fileName, sourceBaseName)
  return parsed.kind === 'transcript' && parsed.targetLanguage ? parsed.targetLanguage : null
}

/**
 * Doc-Pfad: klassifiziert die gelesenen Storage-Transkript-Kandidaten.
 * Muster-A-Dateien werden aus den Kandidaten entfernt (siehe Datei-Kommentar).
 */
export function classifyTranscriptCandidates(args: {
  storageCandidates: ReconcileCandidate[]
  sourceBaseName: string
  sourceName: string
  twinFolderItems: StorageItem[]
  parentPathLength: number | null
}): CollectedNameMigration & { transcriptCandidates: ReconcileCandidate[] } {
  const { storageCandidates, sourceBaseName, sourceName, twinFolderItems, parentPathLength } = args
  const twinPrefix = parentPathLength === null
    ? null
    : parentPathLength + generateShadowTwinFolderName(sourceName).length + 1
  const canonicalLower = `${sourceBaseName}.md`.toLowerCase()

  const transcriptCandidates: ReconcileCandidate[] = []
  const legacyNamed: NameMigrationFileInput[] = []
  let combined: NameMigrationInput['combined'] = null

  for (const candidate of storageCandidates) {
    const pathLength = twinPrefix === null ? null : twinPrefix + candidate.name.length
    const legacyLanguage = parseLegacyLanguage(candidate.name, sourceBaseName)
    if (legacyLanguage && candidate.fileId) {
      const withFrontmatter = hasLeadingFrontmatter(candidate.markdown)
      legacyNamed.push({
        fileId: candidate.fileId, fileName: candidate.name,
        targetLanguage: legacyLanguage, hasFrontmatter: withFrontmatter, pathLength,
        inTwinFolder: true,
      })
      // Muster A ist eine Transformation — raus aus der Transkript-Reconcile.
      if (withFrontmatter) continue
    } else if (
      candidate.fileId &&
      candidate.name.toLowerCase() === canonicalLower &&
      hasLeadingFrontmatter(candidate.markdown)
    ) {
      combined = { fileId: candidate.fileId, fileName: candidate.name, markdown: candidate.markdown, pathLength, inTwinFolder: true }
    }
    transcriptCandidates.push(candidate)
  }

  const existingFiles = twinFolderItems
    .filter((item) => item.type === 'file')
    .map((item) => ({
      fileName: item.metadata.name,
      pathLength: twinPrefix === null ? null : twinPrefix + item.metadata.name.length,
    }))
  existingFiles.push({
    fileName: sourceName,
    pathLength: parentPathLength === null ? null : parentPathLength + sourceName.length,
  })

  return { transcriptCandidates, legacyNamed, combined, existingFiles }
}

/**
 * Adoptions-Pfad: sammelt den Namens-Migrations-Input einer Storage-only-Quelle.
 * Liest NUR legacy-benannte Dateien und die kanonische `{base}.md`.
 * `musterAFileIds` = als Transformation erkannte Legacy-Dateien — sie duerfen
 * NICHT als Transkript adoptiert werden (Adoption nach Rename unter neuem Namen).
 */
export async function collectAdoptionNameMigration(args: {
  source: StorageItem
  parentItems: StorageItem[]
  twinFolderItems: StorageItem[]
  provider: StorageProvider
  parentPathLength: number | null
}): Promise<CollectedNameMigration & { musterAFileIds: Set<string> }> {
  const { source, parentItems, twinFolderItems, provider, parentPathLength } = args
  const sourceName = source.metadata.name
  const sourceBaseName = path.parse(sourceName).name
  const canonicalLower = `${sourceBaseName}.md`.toLowerCase()
  const twinPrefix = parentPathLength === null
    ? null
    : parentPathLength + generateShadowTwinFolderName(sourceName).length + 1

  const legacyNamed: NameMigrationFileInput[] = []
  let combined: NameMigrationInput['combined'] = null
  const musterAFileIds = new Set<string>()
  const existingFiles: NameMigrationInput['existingFiles'] = []
  const seen = new Set<string>()

  const readText = async (fileId: string): Promise<string> => {
    const { blob } = await provider.getBinary(fileId)
    return blob.text()
  }

  const consider = async (item: StorageItem, folderPrefix: number | null, isSibling: boolean) => {
    if (item.type !== 'file' || item.id === source.id || seen.has(item.id)) return
    seen.add(item.id)
    const name = item.metadata.name
    const pathLength = folderPrefix === null ? null : folderPrefix + name.length
    // Geschwister-Dateien zaehlen nur mit `{base}.`-Bezug (fremde Quellen
    // liefern ihren eigenen Report); Twin-Ordner-Dateien zaehlen komplett.
    if (isSibling && !name.toLowerCase().startsWith(`${sourceBaseName.toLowerCase()}.`)) return
    existingFiles.push({ fileName: name, pathLength })

    const legacyLanguage = parseLegacyLanguage(name, sourceBaseName)
    if (legacyLanguage) {
      const withFrontmatter = hasLeadingFrontmatter(await readText(item.id))
      legacyNamed.push({
        fileId: item.id, fileName: name, targetLanguage: legacyLanguage,
        hasFrontmatter: withFrontmatter, pathLength, inTwinFolder: !isSibling,
      })
      if (withFrontmatter) musterAFileIds.add(item.id)
    } else if (!combined && name.toLowerCase() === canonicalLower) {
      const markdown = await readText(item.id)
      if (hasLeadingFrontmatter(markdown)) {
        combined = { fileId: item.id, fileName: name, markdown, pathLength, inTwinFolder: !isSibling }
      }
    }
  }

  for (const item of twinFolderItems) await consider(item, twinPrefix, false)
  for (const item of parentItems) await consider(item, parentPathLength, true)
  existingFiles.push({
    fileName: sourceName,
    pathLength: parentPathLength === null ? null : parentPathLength + sourceName.length,
  })

  return { legacyNamed, combined, existingFiles, musterAFileIds }
}
