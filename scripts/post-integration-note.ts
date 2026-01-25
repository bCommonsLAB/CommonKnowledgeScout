/**
 * Persistiert eine Analyse/Next-Steps Note direkt in MongoDB (ohne HTTP/Token).
 *
 * Motivation:
 * - In Dev/CLI/Agent-Szenarien ist ein Internal Token nicht immer im Env verfügbar.
 * - Für reproduzierbare Agent-Runs wollen wir Notes trotzdem speichern können.
 *
 * Usage:
 *   node --import tsx scripts/post-integration-note.ts <runId>
 */

import crypto from 'node:crypto'
import { getIntegrationTestRun, addIntegrationTestRunNote } from '@/lib/integration-tests/run-store'

async function main(): Promise<void> {
  const runId = String(process.argv[2] || '').trim()
  if (!runId) {
    // eslint-disable-next-line no-console
    console.error('Usage: node --import tsx scripts/post-integration-note.ts <runId>')
    process.exit(1)
  }

  const run = await getIntegrationTestRun(runId)
  if (!run) {
    // eslint-disable-next-line no-console
    console.error(`Run nicht gefunden: ${runId}`)
    process.exit(1)
  }

  const note = {
    noteId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    authorType: 'agent' as const,
    authorEmail: run.userEmail,
    title: 'Audio Suite: Contracts & Transcript-Qualität',
    analysisMarkdown: [
      `## Kontext`,
      `- runId: \`${run.runId}\``,
      `- libraryId: \`${run.libraryId}\``,
      `- folderId: \`${run.folderId}\``,
      '',
      '## Analyse',
      '- Audio Integrationstests laufen jetzt stabil (Happy Path / Gate Skip / Force Recompute).',
      '- Domain-Regel: **leeres/Whitespace Markdown darf nicht als Shadow‑Twin gespeichert werden** (Service + Stores + Repo).',
      '- Global Contract: `completed` darf **keine running Steps** enthalten (sonst inkonsistenter Zustand).',
      '- Fix: In `extract-only.ts` wird die Extract-Phase korrekt als `completed` markiert (job_type-basiert: `extract_audio`/`extract_video`/`extract_pdf`).',
      '',
    ].join('\n'),
    nextStepsMarkdown: [
      '## Nächste Schritte',
      '- Optional: `checkStepStatus()` in den Validatoren von WARN → ERROR umstellen, wenn wir künftig strikt sein wollen (derzeit reicht Global Contract).',
      '- Optional: Audio „Template+Ingest“ UseCase ergänzen, sobald ein passendes Audio-Template existiert.',
      '',
    ].join('\n'),
  }

  await addIntegrationTestRunNote(runId, note)
  // eslint-disable-next-line no-console
  console.log('OK')
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})

