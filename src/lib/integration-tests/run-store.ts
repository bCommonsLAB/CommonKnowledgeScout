/**
 * @fileoverview Integration Test Run Store (MongoDB)
 *
 * @description
 * Früher war das ein In-Memory Store (`globalThis`). Das war dev-friendly,
 * aber nach Server-Restarts waren Runs weg.
 *
 * Jetzt wird persistent in MongoDB gespeichert (Collection `integration_tests`),
 * damit Agent/CLI Runs stabil abrufbar sind und wir eine saubere History haben.
 */

import type { IntegrationTestRunResult } from '@/lib/integration-tests/orchestrator'
import type { IntegrationTestRunDoc, IntegrationTestRunNoteDoc } from '@/lib/repositories/integration-tests-repo'
import {
  appendIntegrationTestRunNote,
  getIntegrationTestRunById,
  listIntegrationTestRunsFromDb,
  upsertIntegrationTestRun,
} from '@/lib/repositories/integration-tests-repo'

export interface StoredIntegrationTestRunNote {
  noteId: string
  createdAt: string
  /**
   * Autor-Typ (für UI/Filter).
   * - 'auto': automatisch generiert (Server/Heuristiken)
   * - 'agent': von Agent/CLI geschrieben
   * - 'user': manuell in der UI geschrieben
   */
  authorType: 'auto' | 'agent' | 'user'
  /** Optional: E-Mail (bei Clerk/UI oder Agent Runs) */
  authorEmail?: string
  /** Optionaler Titel */
  title?: string
  /** Freitext Analyse (Markdown) */
  analysisMarkdown: string
  /** Konkrete nächste Schritte (Markdown) */
  nextStepsMarkdown: string
}

export interface StoredIntegrationTestRun {
  runId: string
  createdAt: string
  userEmail: string
  libraryId: string
  folderId: string
  testCaseIds: string[]
  fileIds?: string[]
  jobTimeoutMs?: number
  templateName?: string
  result: IntegrationTestRunResult
  notes?: StoredIntegrationTestRunNote[]
}

function toIsoStringSafe(d: unknown): string {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString()
  // Falls ein ISO-String im DB-Dokument liegt (oder ein unerwarteter Typ), versuchen wir es defensiv.
  const s = typeof d === 'string' ? d : ''
  const parsed = s ? new Date(s) : null
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return new Date().toISOString()
}

function mapNoteDocToStored(note: IntegrationTestRunNoteDoc): StoredIntegrationTestRunNote {
  return {
    noteId: note.noteId,
    createdAt: toIsoStringSafe(note.createdAt),
    authorType: note.authorType,
    authorEmail: note.authorEmail,
    title: note.title,
    analysisMarkdown: note.analysisMarkdown,
    nextStepsMarkdown: note.nextStepsMarkdown,
  }
}

function mapRunDocToStored(doc: IntegrationTestRunDoc): StoredIntegrationTestRun {
  return {
    runId: doc.runId,
    createdAt: toIsoStringSafe(doc.createdAt),
    userEmail: doc.userEmail,
    libraryId: doc.libraryId,
    folderId: doc.folderId,
    testCaseIds: doc.testCaseIds,
    fileIds: doc.fileIds,
    jobTimeoutMs: doc.jobTimeoutMs,
    templateName: doc.templateName,
    result: doc.result,
    notes: Array.isArray(doc.notes) ? doc.notes.map(mapNoteDocToStored) : [],
  }
}

function mapStoredNoteToDoc(note: StoredIntegrationTestRunNote): IntegrationTestRunNoteDoc {
  return {
    noteId: note.noteId,
    createdAt: new Date(note.createdAt),
    authorType: note.authorType,
    authorEmail: note.authorEmail,
    title: note.title,
    analysisMarkdown: note.analysisMarkdown,
    nextStepsMarkdown: note.nextStepsMarkdown,
  }
}

function mapStoredRunToDoc(run: StoredIntegrationTestRun): IntegrationTestRunDoc {
  return {
    runId: run.runId,
    createdAt: new Date(run.createdAt),
    userEmail: run.userEmail,
    libraryId: run.libraryId,
    folderId: run.folderId,
    testCaseIds: run.testCaseIds,
    fileIds: run.fileIds,
    jobTimeoutMs: run.jobTimeoutMs,
    templateName: run.templateName,
    result: run.result,
    notes: Array.isArray(run.notes) ? run.notes.map(mapStoredNoteToDoc) : [],
  }
}

export async function saveIntegrationTestRun(run: StoredIntegrationTestRun): Promise<void> {
  await upsertIntegrationTestRun(mapStoredRunToDoc(run))
}

export async function getIntegrationTestRun(runId: string): Promise<StoredIntegrationTestRun | null> {
  const doc = await getIntegrationTestRunById(runId)
  return doc ? mapRunDocToStored(doc) : null
}

export async function addIntegrationTestRunNote(
  runId: string,
  note: StoredIntegrationTestRunNote
): Promise<StoredIntegrationTestRun | null> {
  const updated = await appendIntegrationTestRunNote({ runId, note: mapStoredNoteToDoc(note) })
  return updated ? mapRunDocToStored(updated) : null
}

function summarizeFailures(run: StoredIntegrationTestRun): Array<{ message: string; count: number; examples: Array<{ testCaseId: string; fileName: string; jobId: string }> }> {
  const byMessage = new Map<string, { count: number; examples: Array<{ testCaseId: string; fileName: string; jobId: string }> }>()
  const results = run.result?.results || []

  for (const r of results) {
    const msgs = r.validation?.messages || []
    const errors = msgs.filter(m => m?.type === 'error' && typeof m?.message === 'string' && m.message.trim().length > 0)
    for (const e of errors) {
      const key = e.message.trim()
      const entry = byMessage.get(key) || { count: 0, examples: [] }
      entry.count += 1
      if (entry.examples.length < 3) {
        entry.examples.push({ testCaseId: r.testCase.id, fileName: r.file.name, jobId: r.jobId })
      }
      byMessage.set(key, entry)
    }
  }

  return Array.from(byMessage.entries())
    .map(([message, v]) => ({ message, count: v.count, examples: v.examples }))
    .sort((a, b) => b.count - a.count)
}

export function buildAutoAnalysisNote(run: StoredIntegrationTestRun): Pick<StoredIntegrationTestRunNote, 'analysisMarkdown' | 'nextStepsMarkdown' | 'title'> {
  const s = run.result?.summary
  const total = s?.total ?? 0
  const passed = s?.passed ?? 0
  const failed = s?.failed ?? 0

  const failures = summarizeFailures(run)

  const lines: string[] = []
  lines.push(`## Run Summary`)
  lines.push(`- runId: \`${run.runId}\``)
  lines.push(`- createdAt: \`${run.createdAt}\``)
  lines.push(`- libraryId: \`${run.libraryId}\``)
  lines.push(`- folderId: \`${run.folderId}\``)
  lines.push(`- template: \`${run.templateName || 'auto'}\``)
  lines.push(`- result: **${passed}/${total} passed**, **${failed} failed**`)
  lines.push('')

  if (failed === 0) {
    lines.push('## Analyse')
    lines.push('Alle Tests sind grün. Aktuell gibt es keine offensichtlichen technischen Blocker aus dem Run-Result.')
    lines.push('')
  } else {
    lines.push('## Analyse (Fehler-Cluster)')
    for (const f of failures.slice(0, 10)) {
      lines.push(`- **(${f.count}×)** ${f.message}`)
      for (const ex of f.examples) {
        lines.push(`  - \`${ex.testCaseId}\` / \`${ex.fileName}\` (jobId: \`${ex.jobId}\`)`)
      }
    }
    lines.push('')
  }

  const next: string[] = []
  next.push('## Nächste Schritte')
  if (failed === 0) {
    next.push('- Optional: Suite auf mehrere Dateien ausweiten (`--fileIds` weglassen)')
    next.push('- Optional: weitere UseCases als Testcases ergänzen (zuerst als „single_job“, dann komplexere Workflows)')
  } else {
    next.push('- **Häufigsten Fehler-Cluster zuerst fixen** (oben nach Häufigkeit sortiert)')
    next.push('- Danach: Run erneut ausführen und prüfen, ob sich die Fehler-Cluster reduzieren')
    next.push('- Wenn ein Cluster nur „Expectation/Validator“ betrifft: Erwartung an neue Shadow‑Twin‑Abstraktion anpassen (storage-agnostisch)')
  }
  next.push('')

  return {
    title: failed === 0 ? 'Auto-Analyse: grün' : `Auto-Analyse: ${failed} Fehler`,
    analysisMarkdown: lines.join('\n'),
    nextStepsMarkdown: next.join('\n'),
  }
}

export async function listIntegrationTestRuns(args?: {
  limit?: number
  libraryId?: string
  folderId?: string
}): Promise<StoredIntegrationTestRun[]> {
  const docs = await listIntegrationTestRunsFromDb(args)
  return docs.map(mapRunDocToStored)
}

