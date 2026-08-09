/**
 * @fileoverview Reine Plan-Logik fuer Storage-only-Quellen (Welle 5a).
 *
 * @description
 * Eine Quelle OHNE Mongo-Dokument, deren Twin-Ordner/Geschwister-Dateien aber
 * Artefakte enthalten, wird nicht mehr uebersprungen, sondern adoptiert:
 * EIN `adopt-storage-only-source` pro Quelle (Zaehler = Artefakt-Anzahl).
 * Die Ausfuehrung uebernimmt Markdown + Bilder ueber den Migrations-Writer
 * (execute-source-plan.ts) — der Plan selbst liest KEINE Inhalte, damit der
 * check-Modus auch bei ~1000 Quellen guenstig bleibt.
 *
 * Liefert einen vollstaendigen {@link SourceSyncPlan}, damit der Orchestrator
 * (run-library-sync.ts) beide Quell-Arten identisch reportet/ausfuehrt.
 *
 * @module shadow-twin/sync-plan
 */

import { planNameMigration, type NameMigrationInput } from './plan-name-migration'
import type { SourceSyncPlan } from './plan-source-sync'
import type { AdoptableArtifact, SyncOperation } from './types'

export interface StorageAdoptionInput {
  sourceId: string
  sourceName: string
  /** Aus Dateinamen erkannte Artefakte (Twin-Ordner + Geschwister). */
  artifacts: AdoptableArtifact[]
  /** Namens-Migration (Welle 5c): Rename/Split laufen VOR der Adoption. */
  nameMigration?: NameMigrationInput
}

/**
 * Plant die Adoption EINER Storage-only-Quelle.
 * Welle 5c: Namens-Migrations-Operationen stehen VOR der Adoption im Plan
 * (der Executor arbeitet in Plan-Reihenfolge; der Migrations-Writer scannt
 * beim Ausfuehren frisch und sieht die umbenannten Dateien) — deren neue
 * Namen werden direkt mit-adoptiert („Aus Alt mach Neu" in EINEM Lauf).
 * Ohne Artefakte und ohne Befunde: leerer Plan (gewoehnliche Datei).
 */
export function planStorageAdoption(input: StorageAdoptionInput): SourceSyncPlan {
  const operations: SyncOperation[] = []
  const notes: string[] = []

  const nameMigrationPlan = input.nameMigration ? planNameMigration(input.nameMigration) : null
  if (nameMigrationPlan) {
    operations.push(...nameMigrationPlan.operations)
    notes.push(...nameMigrationPlan.notes)
  }

  const artifacts = [...input.artifacts, ...(nameMigrationPlan?.adoptableAfterMigration ?? [])]
  if (artifacts.length > 0) {
    const note = `Quelle ohne Datenbank-Eintrag — ${artifacts.length} Artefakt(e) aus dem Storage uebernehmen`
    operations.push({
      type: 'adopt-storage-only-source',
      kind: 'source',
      targetLanguage: '',
      fileName: input.sourceName,
      count: artifacts.length,
      artifacts,
      note,
    })
    notes.push(note)
  }

  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    // Kein Inhalt gelesen: Transkript-Status ist erst nach der Adoption bekannt.
    transcriptStatus: 'empty',
    winnerName: null,
    winnerOrigin: null,
    winnerPages: 0,
    transformationPlans: [],
    operations,
    notes,
  }
}
