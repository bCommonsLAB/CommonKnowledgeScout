/**
 * @fileoverview „Was ist seit X neu?" (Wunschliste 2, W2) — reine Auswertung.
 *
 * @description
 * Einstieg in den Tagesabschluss: Dateien eines Scans, die seit einem
 * Zeitpunkt geaendert wurden, je mit Art (Quelle/Markdown/Contract/Sonstiges)
 * und Erschliessungszustand aus den Twin-Familien (Mongo = Wahrheit). Dazu
 * Artefakte, die seit dem Zeitpunkt in Mongo entstanden/aktualisiert wurden
 * (Spiegel-/Transformations-Writes liegen in `_`-Ordnern, die der Scan nicht
 * als Dateien fuehrt).
 *
 * Bewusste Grenze (ausgewiesen, nicht verschwiegen): Geloeschte und
 * umbenannte Dateien sind ohne Delta-Abfrage des Providers nicht erkennbar —
 * dafuer braeuchte es eine Provider-Faehigkeit (OneDrive `/delta`), die
 * dokumentierte Ausbaustufe bleibt. Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import { documentMediaKindFromName } from '@/lib/external-jobs/enqueue-document-job'
import { getFileKind } from '@/lib/shadow-twin/file-kind'
import type { ArchiveFolderNode } from './archive-types'
import type { RawTwinFamily } from './coverage-inputs'
import { BERICHT_FILE_NAME, INDEX_FILE_NAME } from './archive-scan'

export type AenderungArt = 'quelle' | 'markdown' | 'contract' | 'artefakt' | 'sonstige'
export type Erschliessung = 'kein_twin' | 'transkript' | 'transformation' | 'nicht_zutreffend'

export interface AenderungEintrag {
  path: string
  name: string
  /** Datei-Id der Quelle bzw. sourceId der Familie bei Artefakten. */
  fileId: string
  folderId: string
  modifiedAt: string
  art: AenderungArt
  erschliessung: Erschliessung
  /** Nur bei art 'artefakt': welches Artefakt sich aenderte. */
  artefakt?: string
}

export function artDerDatei(name: string): Exclude<AenderungArt, 'artefakt'> {
  if (name === INDEX_FILE_NAME || name === BERICHT_FILE_NAME) return 'contract'
  const kind = getFileKind(name)
  if (kind === 'audio' || kind === 'video' || documentMediaKindFromName(name)) return 'quelle'
  if (kind === 'markdown') return 'markdown'
  return 'sonstige'
}

export function erschliessungDerFamilie(family: RawTwinFamily | undefined): Erschliessung {
  if (!family) return 'kein_twin'
  if (family.artifacts.some((a) => a.kind === 'transformation')) return 'transformation'
  if (family.artifacts.some((a) => a.kind === 'transcript')) return 'transkript'
  return 'kein_twin'
}

export function aenderungenSeit(args: {
  folders: readonly ArchiveFolderNode[]
  families: readonly RawTwinFamily[]
  seit: Date
  /** Kappung der Liste (Agenten-Fenster); Kappung wird ausgewiesen. */
  max?: number
}): { eintraege: AenderungEintrag[]; gesamt: number; gekappt: boolean } {
  const seitMs = args.seit.getTime()
  const bySource = new Map(args.families.map((f) => [f.sourceId, f]))
  const folderById = new Map(args.folders.map((f) => [f.folderId, f]))
  const eintraege: AenderungEintrag[] = []

  for (const folder of args.folders) {
    for (const file of folder.files) {
      if (file.modifiedAt === null || Date.parse(file.modifiedAt) < seitMs) continue
      const art = artDerDatei(file.name)
      eintraege.push({
        path: file.path, name: file.name, fileId: file.fileId, folderId: folder.folderId,
        modifiedAt: file.modifiedAt, art,
        erschliessung: art === 'quelle' ? erschliessungDerFamilie(bySource.get(file.fileId)) : 'nicht_zutreffend',
      })
    }
  }

  // Artefakte (Mongo): Spiegel/Transformationen seit dem Zeitpunkt — nur fuer
  // Familien, deren Ordner im Scan liegt (sonst gehoeren sie nicht zum Scope).
  for (const family of args.families) {
    const folder = folderById.get(family.parentId)
    if (!folder) continue
    for (const artifact of family.artifacts) {
      if (Date.parse(artifact.updatedAt) < seitMs) continue
      const label = artifact.kind === 'transformation'
        ? `${artifact.templateName ?? '?'}.${artifact.targetLanguage}`
        : artifact.kind
      eintraege.push({
        path: folder.path ? `${folder.path}/${family.sourceName}` : family.sourceName,
        name: family.sourceName, fileId: family.sourceId, folderId: folder.folderId,
        modifiedAt: artifact.updatedAt, art: 'artefakt',
        erschliessung: erschliessungDerFamilie(family), artefakt: label,
      })
    }
  }

  eintraege.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  const max = args.max ?? 200
  return { eintraege: eintraege.slice(0, max), gesamt: eintraege.length, gekappt: eintraege.length > max }
}
