/**
 * Seed-Script für die „Kitchen-Sink"-Test-Library.
 *
 * Liest die Fixture-Templates aus `test-library/templates/*.md`, parst sie mit
 * dem produktiven `parseTemplate` und legt sie als TemplateDocuments in der
 * MongoDB-Collection `templates` an (idempotentes Upsert pro `_id`).
 *
 * NUR Definition-Schicht (Templates). Die Inbox-/Promotion-Fälle (ADR-0004)
 * sind noch nicht implementiert — siehe test-library/RUNBOOK-local.md.
 *
 * Usage:
 *   pnpm tsx scripts/seed-test-library.ts
 *   TEST_LIBRARY_ID=test-kitchen-sink TEST_LIBRARY_USER=you@example.com \
 *     pnpm tsx scripts/seed-test-library.ts
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { connectToDatabase } from '../src/lib/mongodb-service'
import { parseTemplate } from '../src/lib/templates/template-parser'
import type { TemplateDocument } from '../src/lib/templates/template-types'

const TEMPLATES_DIR = join(process.cwd(), 'test-library', 'templates')
const LIBRARY_ID = process.env.TEST_LIBRARY_ID ?? 'test-kitchen-sink'
const USER_EMAIL = process.env.TEST_LIBRARY_USER ?? 'test@commonknowledgescout.local'

function buildDocument(name: string, content: string): TemplateDocument {
  const { template, errors } = parseTemplate(content, name)
  if (errors.length > 0) {
    throw new Error(
      `Template "${name}" hat Parse-Fehler: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
    )
  }
  const now = new Date()
  return {
    _id: `${LIBRARY_ID}:${name}`,
    name,
    libraryId: LIBRARY_ID,
    user: USER_EMAIL,
    metadata: template.metadata,
    systemprompt: template.systemprompt,
    markdownBody: template.markdownBody,
    creation: template.creation,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
}

function loadFixtures(): TemplateDocument[] {
  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md'))
  return files.map((file) => {
    const name = basename(file, '.md')
    const content = readFileSync(join(TEMPLATES_DIR, file), 'utf-8')
    return buildDocument(name, content)
  })
}

async function seedTestLibrary(): Promise<void> {
  try {
    console.log(`Lese Fixtures aus ${TEMPLATES_DIR} …`)
    const docs = loadFixtures()
    console.log(`Verbinde mit MongoDB (libraryId=${LIBRARY_ID}, user=${USER_EMAIL}) …`)
    const db = await connectToDatabase()
    const collection = db.collection<TemplateDocument>('templates')

    for (const doc of docs) {
      // updatedAt nicht über createdAt zurücksetzen: createdAt nur bei Insert.
      const { createdAt, ...rest } = doc
      await collection.updateOne(
        { _id: doc._id },
        { $set: rest, $setOnInsert: { createdAt } },
        { upsert: true }
      )
      console.log(`✓ ${doc._id}`)
    }

    console.log(`\n✅ ${docs.length} Test-Library-Templates geseedet.`)
    console.log('ℹ️  Inbox-/Promotion-Fälle (ADR-0004) noch nicht enthalten — siehe RUNBOOK-local.md.')
    process.exit(0)
  } catch (error) {
    console.error('Fehler beim Seeden der Test-Library:', error)
    process.exit(1)
  }
}

seedTestLibrary()
