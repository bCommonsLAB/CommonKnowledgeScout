/**
 * Diagnose-Script: liest die geseedeten Kitchen-Sink-Templates aus MongoDB und
 * gibt pro Template die für O1 (Feld-Bindung) relevanten Fakten aus:
 * Wizard- vs. schema-only, editDraft-Feldliste vs. deklarierte Frontmatter-Felder,
 * imageFieldKeys, detailViewType. Read-only, kein Schreibzugriff.
 *
 * Usage: pnpm tsx scripts/inspect-test-library.ts
 */

import { connectToDatabase } from '../src/lib/mongodb-service'
import type { TemplateDocument } from '../src/lib/templates/template-types'

const LIBRARY_ID = process.env.TEST_LIBRARY_ID ?? 'test-kitchen-sink'

function editDraftFields(creation: unknown): string[] | null {
  if (!creation || typeof creation !== 'object') return null
  const flow = (creation as Record<string, unknown>).flow
  if (!flow || typeof flow !== 'object') return null
  const steps = (flow as Record<string, unknown>).steps
  if (!Array.isArray(steps)) return null
  for (const step of steps) {
    if (step && typeof step === 'object' && (step as Record<string, unknown>).preset === 'editDraft') {
      const fields = (step as Record<string, unknown>).fields
      if (Array.isArray(fields)) return fields as string[]
    }
  }
  return null
}

function imageFieldKeys(creation: unknown): string[] {
  if (!creation || typeof creation !== 'object') return []
  const flow = (creation as Record<string, unknown>).flow
  if (!flow || typeof flow !== 'object') return []
  const steps = (flow as Record<string, unknown>).steps
  if (!Array.isArray(steps)) return []
  for (const step of steps) {
    if (step && typeof step === 'object') {
      const keys = (step as Record<string, unknown>).imageFieldKeys
      if (Array.isArray(keys)) return keys as string[]
    }
  }
  return []
}

async function main(): Promise<void> {
  const db = await connectToDatabase()
  const docs = await db
    .collection<TemplateDocument>('templates')
    .find({ libraryId: LIBRARY_ID })
    .sort({ _id: 1 })
    .toArray()

  console.log(`\n=== Kitchen-Sink-Templates (libraryId=${LIBRARY_ID}) ===\n`)
  for (const doc of docs) {
    const declared = doc.metadata?.fields?.map((f) => f.key) ?? []
    const wizard = !!doc.creation
    const fields = editDraftFields(doc.creation)
    const images = imageFieldKeys(doc.creation)
    const detailViewType = doc.metadata?.detailViewType ?? '(keiner)'

    console.log(`• ${doc.name}`)
    console.log(`    Konsument:      ${wizard ? 'WIZARD' : 'schema-only (JobWorker)'}`)
    console.log(`    detailViewType: ${String(detailViewType)}`)
    console.log(`    Frontmatter:    [${declared.join(', ')}]`)
    if (wizard) {
      console.log(`    editDraft.fields: ${fields ? `[${fields.join(', ')}]` : '(keine → Fallback: ALLE Felder)'}`)
      const bound = fields ?? declared
      const excluded = declared.filter((k) => !bound.includes(k))
      console.log(`    NICHT gebunden:   [${excluded.join(', ')}]`)
      if (images.length > 0) console.log(`    imageFieldKeys:   [${images.join(', ')}]`)
    }
    console.log('')
  }
  process.exit(0)
}

main().catch((error) => {
  console.error('Fehler:', error)
  process.exit(1)
})
