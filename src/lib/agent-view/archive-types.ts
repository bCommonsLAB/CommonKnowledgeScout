/**
 * @fileoverview Datenformen des Archiv-Scans (Agentensicht, Welle 1).
 *
 * @description
 * Der Archiv-Scan liefert die Sicht, die ein Agent beim Betreten des
 * Dateisystems hat: Ordner, ihre Contract-Dateien (`_INDEX.md`, `BERICHT.md`)
 * und die enthaltenen Dateien. Bewusst PROVIDER-FREI typisiert — die Regeln
 * arbeiten auf diesen Formen und sind damit ohne Storage unit-testbar
 * (`storage-abstraction.mdc`: UI/Regeln kennen kein Backend).
 *
 * @module agent-view
 */

import type { Bearbeitungsstand } from './types'

/** Eine Datei im Archiv (Twin-Ordner-Inhalte zaehlen NICHT dazu). */
export interface ArchiveFileEntry {
  fileId: string
  name: string
  /** Library-relativer Pfad (`a/b/x.pdf`). */
  path: string
  /** ISO-Zeitstempel der letzten Aenderung; null = unbekannt. */
  modifiedAt: string | null
}

/** Eine gelesene Contract-Datei (`_INDEX.md` / `BERICHT.md`). */
export interface ArchiveDocEntry extends ArchiveFileEntry {
  /** Flaches Frontmatter (Obsidian-kompatibel, AGENTS.md). */
  meta: Record<string, unknown>
  /** Body OHNE Frontmatter — Grundlage des Verweis-Audits. */
  body: string
}

/** Ein `_`-Twin-Ordner neben einer Quelle (Contract §2). */
export interface ArchiveTwinFolderEntry {
  folderId: string
  name: string
  path: string
  /** Name der Quelldatei, die der Ordnername behauptet (`_X.pdf` → `X.pdf`). */
  expectedSourceName: string
  /** Quelldatei im selben Ordner gefunden? */
  sourcePresent: boolean
  /** Dateinamen im Twin-Ordner (fuer das Verweis-Audit aufloesbar). */
  artifactNames: string[]
}

/** Ein Ordnerknoten des Archiv-Scans. */
export interface ArchiveFolderNode {
  folderId: string
  name: string
  /** Library-relativer Pfad; '' fuer die Scan-Wurzel. */
  path: string
  parentFolderId: string | null
  depth: number
  files: ArchiveFileEntry[]
  twinFolders: ArchiveTwinFolderEntry[]
  index: ArchiveDocEntry | null
  bericht: ArchiveDocEntry | null
  /** Erklaerter Stand aus dem `_INDEX.md` (Zyklus §4); null = nicht erklaert. */
  bearbeitungsstand: Bearbeitungsstand | null
  /** `bearbeitungsstand_seit` als ISO-Datum; null = nicht gesetzt/unlesbar. */
  bearbeitungsstandSeit: string | null
  /** Teilbaum konnte nicht (vollstaendig) gelesen werden — isolierter Fehler. */
  error?: string
}

export interface ArchiveScanResult {
  folders: ArchiveFolderNode[]
  /** Durch Ausschluss-Muster uebersprungen (Welle 0b, sichtbar gezaehlt). */
  skippedExcluded: number
}
