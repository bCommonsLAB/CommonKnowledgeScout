/**
 * @fileoverview Reine Plan-Logik fuer EINE Quelle: alle Sync-Operationen.
 *
 * @description
 * Kombiniert pro Quelle (Design §3/§4):
 * - Transkript: {@link buildTranscriptReconcilePlan} („vollstaendigste Fassung
 *   gewinnt") → write-canonical/update-mongo/delete-Operationen.
 * - Transformationen: {@link planTransformationSync} (Inhalt → Uhr → Konflikt).
 * - Bilder: fehlende Storage-Spiegel (`mirror-image-to-storage`, nur Export)
 *   und rekonstruierbare `page_*`-Bilder (`register-image-fragments`, B1).
 * - `needs-pipeline`: Quelldatei neuer als alle Artefakte → Report-only-Hinweis.
 *   Die Spiegel-Konsistenz wird trotzdem geplant — Reparieren macht Mongo und
 *   Storage untereinander konsistent, Neu-Generieren bleibt Sache der Pipeline.
 *
 * Reine Funktion, kein I/O: der Aufrufer (Engine, PR B) sammelt die Kandidaten
 * und fuehrt die gefilterten Operationen aus (allowed-ops.ts).
 *
 * @module shadow-twin/sync-plan
 */

import { buildTranscriptReconcilePlan, type ReconcileCandidate, type ReconcileStatus } from '../reconcile-plan'
import { planTransformationSync, TIMESTAMP_TOLERANCE_MS, type TransformationSyncInput, type TransformationSyncPlan } from './plan-transformation-sync'
import type { SyncOperation } from './types'

export interface SourceSyncInput {
  sourceId: string
  sourceName: string
  /** modifiedAt der Quelldatei (fuer needs-pipeline; null/undefined = unbekannt). */
  sourceModifiedAt?: Date | null
  /** Kanonischer Transkript-Dateiname (`{base}.md`). */
  canonicalTranscriptName: string
  /** Transkript-Kandidaten (Storage-Varianten + Mongo-Record), wie Reconcile. */
  transcriptCandidates: ReconcileCandidate[]
  /** updatedAt des Mongo-Transkript-Records (fuer needs-pipeline). */
  transcriptUpdatedAt?: Date | null
  /** Tote `page_NNN.md` im Twin-Ordner (immer loeschbar). */
  deadPageMd?: Array<{ fileId: string; name: string }>
  /** Erwartete Seitenzahl (needs-reextract-Heuristik). */
  expectedPages?: number
  /** Alle Transformations-Slots (Union aus Mongo-Records und Storage-Dateien). */
  transformations?: TransformationSyncInput[]
  /** Mongo-`binaryFragments`, die im Storage-Twin-Ordner fehlen (Export-Spiegel). */
  imagesMissingInStorage?: Array<{ name: string }>
  /** Anzahl rekonstruierbarer `page_*`/`preview_*`-Bilder ohne Mongo-Fragmente (B1). */
  reconstructablePageImages?: number
}

export interface SourceSyncPlan {
  sourceId: string
  sourceName: string
  /** Transkript-Gesamtstatus ('empty' = keine nicht-leeren Kandidaten). */
  transcriptStatus: ReconcileStatus
  /** Einzel-Ergebnisse der Transformations-Planung (fuer Report-Detail). */
  transformationPlans: TransformationSyncPlan[]
  /** Alle geplanten Operationen (inkl. Report-only: conflict, needs-pipeline). */
  operations: SyncOperation[]
  /** Klartext-Hinweise (invalid-empty, needs-reextract, Konflikt-Gruende). */
  notes: string[]
}

/** Juengster Artefakt-Zeitstempel (Transkript + Transformations-Mongo-Records). */
function newestArtifactTime(input: SourceSyncInput): number | null {
  const times: number[] = []
  const transcriptTime = input.transcriptUpdatedAt?.getTime()
  if (typeof transcriptTime === 'number' && Number.isFinite(transcriptTime)) times.push(transcriptTime)
  for (const t of input.transformations ?? []) {
    const time = t.mongo?.updatedAt?.getTime()
    if (typeof time === 'number' && Number.isFinite(time)) times.push(time)
  }
  return times.length > 0 ? Math.max(...times) : null
}

/** Plant alle Sync-Operationen EINER Quelle (siehe Datei-Kommentar). */
export function planSourceSync(input: SourceSyncInput): SourceSyncPlan {
  const operations: SyncOperation[] = []
  const notes: string[] = []

  // ── Transkript: Reconcile-Plan → Operationen ─────────────────────────
  const transcriptPlan = buildTranscriptReconcilePlan({
    canonicalName: input.canonicalTranscriptName,
    transcriptCandidates: input.transcriptCandidates,
    deadPageMd: input.deadPageMd,
    expectedPages: input.expectedPages,
  })

  if (transcriptPlan.status === 'ok' && transcriptPlan.winnerMarkdown) {
    if (transcriptPlan.canonicalNeedsWrite) {
      const canonicalStorage = input.transcriptCandidates.find(
        (c) => c.origin === 'storage' && c.name === input.canonicalTranscriptName,
      )
      operations.push({
        type: 'write-canonical-transcript', kind: 'transcript', targetLanguage: '',
        fileName: input.canonicalTranscriptName, fileId: canonicalStorage?.fileId,
        markdown: transcriptPlan.winnerMarkdown, overwrite: !!canonicalStorage,
      })
    }
    if (transcriptPlan.mongoNeedsUpdate) {
      operations.push({
        type: 'update-mongo-transcript', kind: 'transcript', targetLanguage: '',
        fileName: input.canonicalTranscriptName, markdown: transcriptPlan.winnerMarkdown,
      })
    }
  }
  if (transcriptPlan.status === 'conflict') {
    const note = 'Transkript: mehrere gleich vollstaendige Fassungen mit verschiedenem Inhalt — manuell pruefen'
    operations.push({ type: 'conflict', kind: 'transcript', targetLanguage: '', fileName: input.canonicalTranscriptName, note })
    notes.push(note)
  }
  if (transcriptPlan.status === 'needs-reextract') {
    notes.push(`Transkript: nur ${transcriptPlan.winnerPages} Seite(n) trotz ${input.expectedPages} erwartet — Neu-Extraktion noetig`)
  }
  for (const deletion of transcriptPlan.deletions) {
    operations.push({
      type: deletion.reason === 'dead-page-md' ? 'delete-dead-page-md' : 'delete-inferior-variant',
      kind: 'transcript', targetLanguage: '', fileName: deletion.name, fileId: deletion.fileId,
    })
  }

  // ── Transformationen (Inhalt → Uhr → Konflikt) ───────────────────────
  const transformationPlans = (input.transformations ?? []).map((t) => planTransformationSync(t))
  for (const plan of transformationPlans) {
    if (plan.operation) operations.push(plan.operation)
    if (plan.note) notes.push(`Transformation ${plan.templateName}/${plan.targetLanguage || '–'}: ${plan.note}`)
  }

  // ── Bilder ───────────────────────────────────────────────────────────
  for (const image of input.imagesMissingInStorage ?? []) {
    operations.push({ type: 'mirror-image-to-storage', kind: 'image', targetLanguage: '', fileName: image.name })
  }
  if ((input.reconstructablePageImages ?? 0) > 0) {
    operations.push({
      type: 'register-image-fragments', kind: 'image', targetLanguage: '',
      fileName: '', count: input.reconstructablePageImages,
    })
  }

  // ── needs-pipeline: Quelldatei neuer als alle Artefakte ──────────────
  const sourceTime = input.sourceModifiedAt?.getTime()
  const artifactTime = newestArtifactTime(input)
  if (
    typeof sourceTime === 'number' && Number.isFinite(sourceTime) &&
    artifactTime !== null && sourceTime - artifactTime > TIMESTAMP_TOLERANCE_MS
  ) {
    operations.push({
      type: 'needs-pipeline', kind: 'source', targetLanguage: '', fileName: input.sourceName,
      note: 'Quelldatei ist neuer als alle Artefakte — Pipeline-Neuverarbeitung noetig',
    })
  }

  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    transcriptStatus: transcriptPlan.status,
    transformationPlans,
    operations,
    notes,
  }
}
