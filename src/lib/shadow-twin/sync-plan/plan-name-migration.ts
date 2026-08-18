/**
 * @fileoverview Reine Plan-Logik der Namens-Migration (Welle 5c, „Aus Alt mach Neu").
 *
 * @description
 * Erkennt Legacy-Namenskonventionen einer Quelle und plant ihre Migration:
 * - Muster A: `{base}.{lang}.md` MIT Frontmatter = alte Transformation →
 *   `migrate-legacy-artifact-name` (Rename auf `{base}.{template}.{lang}.md`).
 * - Muster B: `{base}.md` MIT Frontmatter = Kombi-Datei (Transformations-
 *   Frontmatter + Transkript-Body) → `split-combined-artifact` (Kopie als
 *   Transformation; das Original bleibt Transkript).
 * - `{base}.{lang}.md` OHNE Frontmatter = altes Transkript →
 *   `legacy-transcript-name` (Report-only).
 * - `path-too-long`: relative Pfade ueber dem Budget (Report-only; OneDrive
 *   erlaubt 400 Zeichen inkl. ~53 Zeichen Site-Praefix ⇒ Default 347).
 *
 * Rename/Split werden NUR geplant, wenn der Template-Name bekannt ist
 * (Library-Config `secretaryService.template`), der Ziel-Name noch nicht
 * existiert und der Ziel-Pfad im Budget liegt — sonst Report-Befund
 * (`conflict` bzw. `path-too-long`). Pfadlaengen kommen als Naeherung aus dem
 * Storage-Scan; `null` = unbekannt (z.B. sourceIds-Scope) ⇒ kein Budget-Check.
 *
 * Reine Funktion ohne I/O — die Frontmatter-Erkennung (erste Zeile `---`)
 * macht die Collect-Schicht (collect-name-migration.ts).
 *
 * @module shadow-twin/sync-plan
 */

import type { AdoptableArtifact, SyncOperation } from './types'

/** Pfad-Budget in Zeichen: OneDrive-Limit 400 minus ~53 Zeichen Site-Praefix. */
export const DEFAULT_PATH_BUDGET = 347

export interface NameMigrationFileInput {
  fileId: string
  fileName: string
  /** Sprachcode aus dem Legacy-Namen (`{base}.{lang}.md`). */
  targetLanguage: string
  /** Erste Zeile der Datei ist `---` (Frontmatter vorhanden). */
  hasFrontmatter: boolean
  /** Laenge des relativen Pfads (Ordner + Name); null = unbekannt. */
  pathLength: number | null
  /**
   * Datei liegt im Twin-Ordner. Nur dann ist sie nach dem Rename/Split im
   * selben Lauf adoptierbar — der Migrations-Writer scannt beim Ausfuehren
   * ausschliesslich den Twin-Ordner.
   */
  inTwinFolder: boolean
}

export interface NameMigrationInput {
  sourceBaseName: string
  /** Legacy-benannte Dateien `{base}.{lang}.md` (Twin-Ordner + Geschwister). */
  legacyNamed: NameMigrationFileInput[]
  /** Kombi-Kandidat `{base}.md` MIT Frontmatter (Inhalt fuer die Split-Kopie). */
  combined: {
    fileId: string
    fileName: string
    markdown: string
    pathLength: number | null
    inTwinFolder: boolean
  } | null
  /** Bekannte Dateien im Quell-Umfeld (Kollisions-Check + Pfad-Budget-Report). */
  existingFiles: Array<{ fileName: string; pathLength: number | null }>
  /** Standard-Template der Library; null = nicht gesetzt (⇒ nur Report). */
  templateName: string | null
  /** Zielsprache fuer die Split-Kopie (Library-Config, Fallback 'de'). */
  splitTargetLanguage: string
  /** Pfad-Budget in Zeichen ({@link DEFAULT_PATH_BUDGET}). */
  pathBudget: number
}

export interface NameMigrationPlan {
  operations: SyncOperation[]
  notes: string[]
  /** Nach Rename/Split unter neuem Namen adoptierbare Transformationen. */
  adoptableAfterMigration: AdoptableArtifact[]
}

/** Plant die Namens-Migration EINER Quelle (siehe Datei-Kommentar). */
export function planNameMigration(input: NameMigrationInput): NameMigrationPlan {
  const operations: SyncOperation[] = []
  const notes: string[] = []
  const adoptableAfterMigration: AdoptableArtifact[] = []
  // Kollisions-Check konservativ ueber ALLE bekannten Namen (Twin-Ordner +
  // Geschwister); geplante Ziele werden mit aufgenommen (keine Doppel-Ziele).
  const takenNames = new Set(input.existingFiles.map((f) => f.fileName.toLowerCase()))

  // Pfad-Budget-Report fuer BESTEHENDE Dateien (der manuelle Skript-Check aus
  // der Umweltarchiv-Session, jetzt im Plan).
  for (const file of input.existingFiles) {
    if (file.pathLength !== null && file.pathLength > input.pathBudget) {
      operations.push({
        type: 'path-too-long', kind: 'source', targetLanguage: '', fileName: file.fileName,
        note: `Relativer Pfad ${file.pathLength} Zeichen > Budget ${input.pathBudget} — Datei-/Ordnernamen kuerzen`,
      })
    }
  }

  /** Gemeinsame Wache fuer Rename und Split; liefert den Ziel-Namen oder null. */
  const gateTarget = (args: { sourceFileName: string; targetLanguage: string; pathLength: number | null }): string | null => {
    if (!input.templateName) {
      const note = `Legacy-Transformation erkannt (${args.sourceFileName}), aber kein Standard-Template in der Library-Config — Ziel-Name nicht ableitbar`
      operations.push({ type: 'conflict', kind: 'transformation', targetLanguage: args.targetLanguage, fileName: args.sourceFileName, note })
      notes.push(note)
      return null
    }
    const target = `${input.sourceBaseName}.${input.templateName}.${args.targetLanguage}.md`
    if (takenNames.has(target.toLowerCase())) {
      const note = `Ziel-Name ${target} existiert bereits — ${args.sourceFileName} manuell pruefen`
      operations.push({ type: 'conflict', kind: 'transformation', targetLanguage: args.targetLanguage, fileName: args.sourceFileName, note })
      notes.push(note)
      return null
    }
    const targetPathLength = args.pathLength !== null ? args.pathLength - args.sourceFileName.length + target.length : null
    if (targetPathLength !== null && targetPathLength > input.pathBudget) {
      operations.push({
        type: 'path-too-long', kind: 'transformation', targetLanguage: args.targetLanguage, fileName: args.sourceFileName,
        newFileName: target,
        note: `Ziel-Pfad ${targetPathLength} Zeichen > Budget ${input.pathBudget} — Migration nicht planbar, Namen kuerzen`,
      })
      return null
    }
    takenNames.add(target.toLowerCase())
    return target
  }

  for (const file of input.legacyNamed) {
    if (!file.hasFrontmatter) {
      // Altes Transkript: kanonisch waere `{base}.md` — nur melden (Reconcile
      // behandelt es weiterhin als Transkript-Variante).
      operations.push({
        type: 'legacy-transcript-name', kind: 'transcript', targetLanguage: file.targetLanguage,
        fileName: file.fileName, fileId: file.fileId,
        note: `Altes Transkript im Legacy-Namen — kanonisch ist ${input.sourceBaseName}.md`,
      })
      continue
    }
    // Muster A: Rename auf die aktuelle Transformations-Konvention.
    const target = gateTarget({ sourceFileName: file.fileName, targetLanguage: file.targetLanguage, pathLength: file.pathLength })
    if (!target) continue
    const note = `Legacy-Transformation → ${target} umbenennen`
    operations.push({
      type: 'migrate-legacy-artifact-name', kind: 'transformation', targetLanguage: file.targetLanguage,
      templateName: input.templateName as string, fileName: file.fileName, fileId: file.fileId,
      newFileName: target, note,
    })
    notes.push(note)
    // Welle 0c: auch Sidecar-Ziele sind adoptierbar (der Executor laedt jetzt
    // Twin-Ordner UND Nachbardateien der Quelle) — kein `inTwinFolder`-Gate mehr.
    adoptableAfterMigration.push({
      fileName: target, kind: 'transformation',
      targetLanguage: file.targetLanguage, templateName: input.templateName as string,
    })
  }

  if (input.combined) {
    // Muster B: Kombi-Datei als Transformation kopieren, Original bleibt Transkript.
    const target = gateTarget({
      sourceFileName: input.combined.fileName,
      targetLanguage: input.splitTargetLanguage,
      pathLength: input.combined.pathLength,
    })
    if (target) {
      const note = `Kombi-Datei ${input.combined.fileName} → Kopie als ${target} (Original bleibt Transkript)`
      operations.push({
        type: 'split-combined-artifact', kind: 'transformation', targetLanguage: input.splitTargetLanguage,
        templateName: input.templateName as string, fileName: input.combined.fileName, fileId: input.combined.fileId,
        newFileName: target, markdown: input.combined.markdown, note,
      })
      notes.push(note)
      // Welle 0c: siehe oben — Sidecar-Kopien sind ebenfalls adoptierbar.
      adoptableAfterMigration.push({
        fileName: target, kind: 'transformation',
        targetLanguage: input.splitTargetLanguage, templateName: input.templateName as string,
      })
    }
  }

  return { operations, notes, adoptableAfterMigration }
}
