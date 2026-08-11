/**
 * @fileoverview Fixture-Verifikation der Shadow-Twin-Reparatur (Skill shadow-twin-verify).
 *
 * Legt Legacy-Fixtures (Muster A/B + Alt-Transkript) in einer LOCAL-Library an,
 * prueft die Engine-Planung read-only (Presets repair + import) und optional
 * die echte Reparatur inkl. Mongo-Verifikation. Raeumt Storage UND Mongo auf.
 *
 * @usage pnpm tsx .claude/skills/shadow-twin-verify/verify-fixture.ts \
 *          --libraryId=<id> --email=<owner> [--apply] [--keep]
 */
import * as dotenv from 'dotenv'
dotenv.config()

import fs from 'fs'
import path from 'path'
import { LibraryService } from '@/lib/services/library-service'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { deleteShadowTwinBySourceId, getShadowTwinsBySourceIds, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'
import type { SourceSyncReportRow } from '@/lib/shadow-twin/sync-engine/report-types'

const BASE = 'welle5-verify-fixture'
let failures = 0

function arg(key: string): string | undefined {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : undefined
}
const flag = (key: string): boolean => process.argv.slice(2).includes(`--${key}`)

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

function opTypes(row: SourceSyncReportRow, onlySelected: boolean): string[] {
  return row.operations.filter((op) => !onlySelected || op.selected).map((op) => op.type)
}

async function main(): Promise<void> {
  const libraryId = arg('libraryId')
  const email = arg('email')
  if (!libraryId || !email) {
    console.error('Fehlt: --libraryId=<id> und --email=<owner>')
    process.exit(2)
  }
  // Prod-Sperre: Verifikation laeuft NUR gegen die Dev-DB. Die .env kann
  // (temporaer) auf Prod zeigen — dann Dev explizit per Env-Override erzwingen:
  //   MONGODB_DATABASE_NAME=common-knowledge-scout pnpm tsx ... (Prozess-Env schlaegt .env)
  const dbName = process.env.MONGODB_DATABASE_NAME ?? ''
  const prodName = process.env.MONGODB_DATABASE_NAME_PROD ?? ''
  if (!dbName || dbName.endsWith('-prod') || (prodName && dbName === prodName)) {
    console.error(`ABBRUCH: MONGODB_DATABASE_NAME="${dbName}" sieht nach Prod aus — Fixture-Tests nur gegen die Dev-DB.`)
    process.exit(2)
  }
  const library = await LibraryService.getInstance().getLibrary(email, libraryId)
  if (!library || library.type !== 'local' || !library.path) {
    console.error('Library nicht gefunden oder keine LOCAL-Library — Fixture-Test braucht Dateisystem-Zugriff.')
    process.exit(2)
  }
  const secretary = library.config?.secretaryService as { template?: string; targetLanguage?: string } | undefined
  const template = secretary?.template?.trim()
  if (!template) {
    console.error('Library hat kein Standard-Template (config.secretaryService.template) — anderes Testbett waehlen.')
    process.exit(2)
  }
  const splitLang = secretary?.targetLanguage || 'de'
  const musterALang = splitLang === 'en' ? 'it' : 'en'

  const src = path.join(library.path, `${BASE}.pdf`)
  const twin = path.join(library.path, `_${BASE}.pdf`)
  const cleanupFiles = (): void => {
    fs.rmSync(twin, { recursive: true, force: true })
    fs.rmSync(src, { force: true })
  }

  fs.writeFileSync(src, '%PDF-1.4 welle5-verify-fixture (dummy)')
  fs.mkdirSync(twin, { recursive: true })
  fs.writeFileSync(path.join(twin, `${BASE}.${musterALang}.md`), '---\ntitle: Alte Transformation\n---\nMuster A')
  fs.writeFileSync(path.join(twin, `${BASE}.md`), '---\ntitle: Kombi\n---\nTranskript-Body (Muster B)')
  fs.writeFileSync(path.join(twin, `${BASE}.fr.md`), '# Altes Transkript ohne Frontmatter')

  let fixtureSourceId: string | null = null
  try {
    // ── Schritt 1a: check, preset repair ─────────────────────────────────
    const repairCheck = await runLibrarySync({
      libraryId, userEmail: email, mode: 'check', preset: 'repair',
      scope: { folderId: 'root', recursive: false },
    })
    const row = repairCheck.sources.find((s) => s.sourceName === `${BASE}.pdf`)
    check('Fixture-Quelle im Report (repair-check)', !!row)
    if (row) {
      fixtureSourceId = row.sourceId
      const selected = opTypes(row, true)
      const planned = opTypes(row, false)
      const renameOp = row.operations.find((op) => op.type === 'migrate-legacy-artifact-name')
      check('Muster A: Rename selected mit korrektem Ziel',
        selected.includes('migrate-legacy-artifact-name') && renameOp?.newFileName === `${BASE}.${template}.${musterALang}.md`,
        renameOp?.newFileName)
      check('Muster B: Split selected', selected.includes('split-combined-artifact'))
      check('Alt-Transkript: report-only', planned.includes('legacy-transcript-name') && !selected.includes('legacy-transcript-name'))
      check('Adoption selected', selected.includes('adopt-storage-only-source'))
    }
    check('repair-check ohne Fehler', repairCheck.errors === 0, `errors=${repairCheck.errors}`)

    // ── Schritt 1b: check, preset import ─────────────────────────────────
    const importCheck = await runLibrarySync({
      libraryId, userEmail: email, mode: 'check', preset: 'import',
      scope: { folderId: 'root', recursive: false },
    })
    const importRow = importCheck.sources.find((s) => s.sourceName === `${BASE}.pdf`)
    if (importRow) {
      const selected = opTypes(importRow, true)
      check('Import: NUR Adoption selected (nie Rename/Split)',
        selected.includes('adopt-storage-only-source') &&
        !selected.includes('migrate-legacy-artifact-name') && !selected.includes('split-combined-artifact'),
        selected.join(','))
    } else {
      check('Fixture-Quelle im Report (import-check)', false)
    }

    // ── Schritt 2 (optional): echte Reparatur + Mongo-Verifikation ───────
    if (flag('apply')) {
      const repair = await runLibrarySync({
        libraryId, userEmail: email, mode: 'repair', preset: 'repair',
        scope: { folderId: 'root', recursive: false },
      })
      check('repair ohne Fehler', repair.errors === 0, `errors=${repair.errors}`)
      check('Storage: Rename ausgefuehrt',
        fs.existsSync(path.join(twin, `${BASE}.${template}.${musterALang}.md`)) &&
        !fs.existsSync(path.join(twin, `${BASE}.${musterALang}.md`)))
      check('Storage: Split-Kopie existiert, Original bleibt',
        fs.existsSync(path.join(twin, `${BASE}.${template}.${splitLang}.md`)) &&
        fs.existsSync(path.join(twin, `${BASE}.md`)))

      const sourceId = fixtureSourceId as string
      const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [sourceId] })
      const doc = docs.get(sourceId)
      check('Mongo: Quelle adoptiert', !!doc)
      if (doc) {
        const transcript = readTranscriptRecord(doc)
        check('Mongo: Transkript nicht leer', (transcript?.markdown?.length ?? 0) > 0)
        const slots: Array<{ slot: string; len: number }> = []
        for (const [k1, v1] of Object.entries(doc.artifacts?.transformation ?? {})) {
          for (const [k2, rec] of Object.entries(v1 as Record<string, { markdown?: string }>)) {
            slots.push({ slot: `${k1}/${k2}`, len: rec?.markdown?.length ?? 0 })
          }
        }
        console.log('      Transformations-Slots:', JSON.stringify(slots))
        check('Mongo: Transformations-Slots nicht leer (Leer-Upsert-Guard)',
          slots.length > 0 && slots.every((s) => s.len > 0))
        await deleteShadowTwinBySourceId(libraryId, sourceId)
        console.log('      Mongo-Fixture-Dokument geloescht.')
      }
    }
  } finally {
    if (!flag('keep')) {
      cleanupFiles()
      console.log('Fixtures entfernt.')
    }
  }

  console.log(failures === 0 ? '\nERGEBNIS: ALLE PRUEFUNGEN BESTANDEN' : `\nERGEBNIS: ${failures} PRUEFUNG(EN) FEHLGESCHLAGEN`)
  process.exit(failures === 0 ? 0 : 1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
