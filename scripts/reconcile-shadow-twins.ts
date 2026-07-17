/**
 * @fileoverview CLI-Runner fuer die Shadow-Twin Library-Reconcile.
 *
 * @description
 * Duenner Wrapper um {@link reconcileLibrary} — nutzt DENSELBEN Code wie der
 * Endpoint/UI (keine zweite Implementierung). Bringt Storage + Mongo pro Quelle
 * in den deterministischen Zustand (kanonische `{base}.md` = vollstaendigstes
 * Transkript).
 *
 * Sicherheit:
 * - DEFAULT = DRY-RUN (read-only). Schreiben/Loeschen nur mit `--apply`.
 * - `--apply` braucht zwingend `--libraryId` (Sicherheits-Stopp).
 * - DB = `MONGODB_DATABASE_NAME` (dev). MONGODB_URI wird nie geloggt.
 * - Vor `--apply`: mongodump der Collection (siehe docs/refactor/shadow-twin-deterministic).
 *
 * @usage
 *   pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner>            # Dry-Run, ganze Library
 *   pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner> --sourceId=<id>  # nur eine Quelle
 *   pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner> --apply    # Reparatur (schreibt/loescht)
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { reconcileLibrary } from '@/lib/shadow-twin/reconcile-library'

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

  if (!libraryId || !email) {
    console.error('Fehlt: --libraryId=<id> und --email=<owner> sind erforderlich.')
    process.exit(2)
  }

  console.log(`\nReconcile ${apply ? 'APPLY (schreibt/loescht!)' : 'DRY-RUN (read-only)'}`)
  console.log(`Library: ${libraryId}${sourceId ? ` | Quelle: ${sourceId}` : ' | alle Quellen'}\n`)

  const report = await reconcileLibrary({
    libraryId,
    userEmail: email,
    apply,
    sourceIds: sourceId ? [sourceId] : undefined,
  })

  console.log(
    `Quellen: ${report.totalSources} | geaendert: ${report.changed} | ` +
    `Konflikte: ${report.conflicts} | needs-reextract: ${report.needsReextract}\n`,
  )

  for (const r of report.results) {
    const unchanged =
      r.status === 'ok' && !r.wroteCanonical && !r.updatedMongo && r.deleted.length === 0
    if (unchanged) continue // unveraenderte Quellen nicht ausgeben

    console.log(`- [${r.status}] ${r.sourceName}`)
    if (r.winnerName) console.log(`    Gewinner: ${r.winnerName} (${r.winnerOrigin}, ${r.winnerPages} Seiten)`)
    if (apply) console.log(`    geschrieben: canonical=${r.wroteCanonical} mongo=${r.updatedMongo}`)
    if (r.deleted.length) console.log(`    ${apply ? 'geloescht' : 'wuerde loeschen'}: ${r.deleted.join(', ')}`)
    if (r.note) console.log(`    Hinweis: ${r.note}`)
  }

  console.log('\nFertig.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Reconcile fehlgeschlagen:', err instanceof Error ? err.message : err)
  process.exit(1)
})
