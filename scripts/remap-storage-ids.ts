/**
 * @fileoverview Storage-Ids einer Library nach einem Speicherwechsel umschreiben.
 *
 * @description
 * Nach dem Umzug einer Library auf einen anderen Speicher (z. B. OneDrive →
 * Nextcloud) zeigen Twins, Suchindex, Beziehungen, Sterne, Kommentare und
 * Favoriten auf Ids, die es nicht mehr gibt. Das Skript ordnet alt → neu ueber
 * den library-relativen Pfad zu und schreibt MongoDB um — ohne neu zu
 * transkribieren, zu transformieren oder zu ingestieren.
 *
 * Ablauf:
 *   1. Library zeigt noch auf den ALTEN Speicher:
 *        pnpm tsx scripts/remap-storage-ids.ts --libraryId=<id> --email=<owner> --snapshot
 *      → backups/storage-snapshot-<id>-<zeit>.json (nur Ids und Pfade)
 *   2. Library in den Settings auf den neuen Speicher umhaengen (gleiche Ordnerstruktur).
 *   3. Probelauf (liest den neuen Speicher, schreibt nichts):
 *        pnpm tsx scripts/remap-storage-ids.ts --libraryId=<id> --email=<owner> --from=<snapshot.json>
 *   4. Umschreiben (vorher Sicherung nach backups/):
 *        pnpm tsx scripts/remap-storage-ids.ts --libraryId=<id> --email=<owner> --from=<snapshot.json> --apply
 *
 * Wiederholbar: Bereits umgeschriebene Dokumente tragen die neue Id und werden
 * uebersprungen. Danach `twins_pruefen` als Kontrolle.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import * as fs from 'fs'
import * as path from 'path'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { collectSnapshot, type StorageSnapshot } from '@/lib/storage-remap/snapshot'
import { planRemap } from '@/lib/storage-remap/plan'
import { remapShadowTwins } from '@/lib/storage-remap/remap-twins'
import { remapIndex } from '@/lib/storage-remap/remap-index'
import { remapUserDaten } from '@/lib/storage-remap/remap-user'
import { schreibeSicherung } from '@/lib/storage-remap/backup'

function arg(key: string): string | undefined {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : undefined
}
const flag = (key: string): boolean => process.argv.slice(2).includes(`--${key}`)

async function lesen(libraryId: string, email: string, storageType: string): Promise<StorageSnapshot> {
  const provider = await getServerProvider(email, libraryId)
  return collectSnapshot({
    provider, libraryId, storageType,
    onFolder: (_p, n) => { if (n % 25 === 0) console.log(`  … ${n} Ordner gelesen`) },
  })
}

async function main(): Promise<void> {
  const libraryId = arg('libraryId')
  const email = arg('email')
  const from = arg('from')
  const apply = flag('apply')
  if (!libraryId || !email) throw new Error('Fehlt: --libraryId=<id> und --email=<owner>')
  if (flag('snapshot') === Boolean(from)) throw new Error('Genau eines angeben: --snapshot ODER --from=<datei>')
  if (apply && !from) throw new Error('--apply nur zusammen mit --from=<datei>')

  const library = await LibraryService.getInstance().getLibrary(email, libraryId)
  if (!library) throw new Error(`Library ${libraryId} gehoert nicht ${email}`)
  console.log(`Library: ${library.label} (${library.type}, Verzeichnis "${library.path}")`)

  if (!from) {
    const snap = await lesen(libraryId, email, library.type)
    const dir = path.join(process.cwd(), 'backups')
    fs.mkdirSync(dir, { recursive: true })
    const datei = path.join(dir, `storage-snapshot-${libraryId}-${snap.createdAt.replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(datei, JSON.stringify(snap, null, 2), 'utf8')
    const dateien = snap.entries.filter((e) => e.type === 'file').length
    console.log(`\nSchnappschuss: ${dateien} Dateien, ${snap.entries.length - dateien} Ordner → ${datei}`)
    console.log('Jetzt die Library auf den neuen Speicher umhaengen, dann mit --from=<diese Datei> weiter.')
    return
  }

  const alt = JSON.parse(fs.readFileSync(from, 'utf8')) as StorageSnapshot
  console.log(`Alter Stand: ${alt.storageType}, ${alt.entries.length} Eintraege, ${alt.createdAt}`)
  const neu = await lesen(libraryId, email, library.type)
  const plan = planRemap(alt, neu)
  if (plan.anteilGleicheIds > 0.5) {
    throw new Error(`${Math.round(plan.anteilGleicheIds * 100)} % der Ids sind unveraendert — zeigt die Library noch auf den alten Speicher?`)
  }

  console.log(`\nZuordnung: ${plan.idMap.size} Ids aendern sich, ${plan.ohnePartner.length} ohne Partner, ${plan.nurNeu} nur im neuen Speicher`)
  for (const e of plan.ohnePartner.slice(0, 30)) console.log(`  ! ${e.relPath}: ${e.grund}`)
  if (plan.ohnePartner.length > 30) console.log(`  … und ${plan.ohnePartner.length - 30} weitere`)

  if (apply) console.log(`\nSicherung: ${await schreibeSicherung(library, path.join(process.cwd(), 'backups'))}`)
  const probelauf = !apply
  const twins = await remapShadowTwins(libraryId, plan.idMap, probelauf)
  const index = await remapIndex(library, plan.idMap, probelauf)
  const user = await remapUserDaten(email, library, plan.idMap, probelauf)

  const verb = probelauf ? 'wuerden umgeschrieben' : 'umgeschrieben'
  console.log(`\nTwins: ${twins.umgeschrieben} von ${twins.twins} ${verb}${probelauf ? '' : `, ${twins.segmente} Transkript-Segmente`}`)
  for (const t of twins.ohnePartner) console.log(`  ! Twin ohne Quelle im neuen Speicher: ${t.sourceName}`)
  for (const k of twins.konflikte) console.log(`  ! Konflikt ${k.sourceName}: ${k.grund}`)
  console.log(index.quellenImIndex === null
    ? 'Suchindex: keiner konfiguriert'
    : `Suchindex: ${index.quellenUmgeschrieben} von ${index.quellenImIndex} Quellen ${verb}, ${index.verweiseNachgezogen} Verweise`)
  console.log(`Beziehungen: ${index.beziehungen} | Sterne: ${user.sterne} | Kommentare: ${user.kommentare} | Favoriten: ${user.favoriten}`)
  console.log(probelauf ? '\nPROBELAUF (nichts geschrieben). Ausfuehren mit --apply.' : '\nFertig. Kontrolle: twins_pruefen auf einem Teilordner.')
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(`\nAbbruch: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
