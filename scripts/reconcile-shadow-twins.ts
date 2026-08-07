/**
 * @fileoverview CLI-Runner fuer die Shadow-Twin Sync-Engine (Welle 4).
 *
 * @description
 * Duenner Wrapper um {@link runLibrarySync} — nutzt DENSELBEN Code wie der
 * Endpoint/UI (keine zweite Implementierung). Bringt Storage + Mongo pro Quelle
 * in den deterministischen Zustand (Transkripte, Transformationen, Bilder).
 *
 * Sicherheit:
 * - DEFAULT = CHECK (read-only). Schreiben/Loeschen nur mit `--apply` (repair).
 * - `--apply` braucht zwingend `--libraryId` (Sicherheits-Stopp).
 * - DB = `MONGODB_DATABASE_NAME` (dev). MONGODB_URI wird nie geloggt.
 * - Vor `--apply`: mongodump der Collection (siehe docs/refactor/shadow-twin-deterministic).
 *
 * @usage
 *   pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner>            # Check, ganze Library
 *   pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner> --sourceId=<id>  # nur eine Quelle
 *   pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner> --apply    # Reparatur (schreibt/loescht)
 *   Optional: --preset=repair|export|auto-sync (Default: repair)
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import type { SyncPreset } from '@/lib/shadow-twin/sync-plan/allowed-ops'

function arg(key: string): string | undefined {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : undefined
}
function flag(key: string): boolean {
  return process.argv.slice(2).includes(`--${key}`)
}

async function main(): Promise<void> {
  const libraryId = arg('libraryId')
  const email = arg('email')
  const apply = flag('apply')
  const sourceId = arg('sourceId')
  const presetArg = arg('preset') ?? 'repair'
  if (!['repair', 'export', 'auto-sync'].includes(presetArg)) {
    console.error(`Ungueltiges Preset: ${presetArg} (erlaubt: repair, export, auto-sync)`)
    process.exit(2)
  }
  const preset = presetArg as SyncPreset

  if (!libraryId || !email) {
    console.error('Fehlt: --libraryId=<id> und --email=<owner> sind erforderlich.')
    process.exit(2)
  }

  console.log(`\nSync-Engine ${apply ? 'REPAIR (schreibt/loescht!)' : 'CHECK (read-only)'} | Preset: ${preset}`)
  console.log(`Library: ${libraryId}${sourceId ? ` | Quelle: ${sourceId}` : ' | alle Quellen'}\n`)

  const report = await runLibrarySync({
    libraryId,
    userEmail: email,
    mode: apply ? 'repair' : 'check',
    preset,
    scope: sourceId ? { sourceIds: [sourceId] } : {},
  })

  console.log(
    `Quellen: ${report.totalSources} | ${apply ? 'geaendert' : 'wuerde aendern'}: ${report.changed} | ` +
    `Konflikte: ${report.conflicts} | Pipeline noetig: ${report.needsPipeline} | ` +
    `needs-reextract: ${report.needsReextract} | Fehler: ${report.errors}\n`,
  )

  for (const r of report.sources) {
    const selected = r.operations.filter((op) => op.selected)
    if (selected.length === 0 && !r.error && r.notes.length === 0) continue // unveraenderte Quellen nicht ausgeben

    console.log(`- [${r.transcriptStatus}] ${r.sourceName}`)
    if (r.winnerName) console.log(`    Gewinner: ${r.winnerName} (${r.winnerOrigin}, ${r.winnerPages} Seiten)`)
    for (const op of selected) {
      const outcome = apply ? (op.executed ? 'OK' : `FEHLER: ${op.error ?? '?'}`) : 'geplant'
      console.log(`    ${op.type} ${op.fileName} [${outcome}]`)
    }
    for (const note of r.notes) console.log(`    Hinweis: ${note}`)
    if (r.error) console.log(`    FEHLER: ${r.error}`)
  }
  if (report.sourcesTruncated) console.log('… (Details gekuerzt)')

  console.log('\nFertig.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Sync-Engine fehlgeschlagen:', err instanceof Error ? err.message : err)
  process.exit(1)
})
