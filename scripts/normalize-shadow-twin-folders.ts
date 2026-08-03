/**
 * Normalisiert Shadow-Twin-Ordner einer Library vom Legacy-Praefix `.` auf `_`.
 *
 * Hintergrund: `generateShadowTwinFolderName` erzeugt heute `_Quelle.pdf`.
 * Aeltere Libraries tragen `.Quelle.pdf`. Bisher werden Alt-Ordner beim SUCHEN
 * nur toleriert (`generateShadowTwinFolderNameVariants`) — umbenannt hat sie nie
 * jemand. Dieses Skript zieht den Bestand nach, damit die Legacy-Toleranz im
 * Code danach entfallen kann.
 *
 * Zusaetzlich werden verirrte Artefakte (Transformationen, die NEBEN der
 * Quelldatei liegen) in den Twin-Ordner verschoben. TROCKENLAUF ist Standard:
 * ohne `--apply` wird nur berichtet, was passieren wuerde.
 *
 * Geloescht wird NUR mit `--delete-superseded` und NUR, wenn im Twin-Ordner
 * bereits eine gleichnamige, mindestens gleich aktuelle Datei liegt. Ist die
 * verirrte Datei neuer, bleibt sie unangetastet und wird gemeldet.
 *
 * Aufruf:
 *   node --import tsx scripts/normalize-shadow-twin-folders.ts \
 *     --user <owner-email> --library <library-id> \
 *     [--limit N] [--apply] [--delete-superseded]
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { getServerProvider } from '../src/lib/storage/server-provider'
import { generateShadowTwinFolderName } from '../src/lib/storage/shadow-twin-folder-name'
import type { StorageItem, StorageProvider } from '../src/lib/storage/types'

const LEGACY_PREFIX = '.'
const CURRENT_PREFIX = '_'

interface CliArgs {
  user: string
  library: string
  limit: number | null
  apply: boolean
  /**
   * Verirrte Artefakte LOESCHEN, wenn im Twin-Ordner bereits eine gleichnamige,
   * mindestens gleich aktuelle Datei liegt (sie wird beim naechsten Lauf ohnehin
   * neu berechnet). Ist die verirrte Datei NEUER, wird sie nie geloescht,
   * sondern gemeldet.
   */
  deleteSuperseded: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const user = get('--user')
  const library = get('--library')
  if (!user || !library) {
    throw new Error('Pflicht-Argumente fehlen. Aufruf: --user <owner-email> --library <library-id> [--limit N] [--apply]')
  }
  const limitRaw = get('--limit')
  const limit = limitRaw ? Number(limitRaw) : null
  if (limitRaw && (!Number.isFinite(limit) || (limit as number) <= 0)) {
    throw new Error(`--limit muss eine positive Zahl sein, war: "${limitRaw}"`)
  }
  return {
    user,
    library,
    limit,
    apply: argv.includes('--apply'),
    deleteSuperseded: argv.includes('--delete-superseded'),
  }
}

interface Candidate {
  folder: StorageItem
  parentPath: string
  oldName: string
  newName: string
  /** Ein Ordner mit dem Zielnamen existiert bereits — Umbenennen wuerde kollidieren. */
  collision: boolean
  /** Markdown-Artefakte, die NEBEN der Quelldatei liegen statt im Twin-Ordner. */
  strays: StorageItem[]
}

/**
 * Findet Markdown-Artefakte, die NEBEN der Quelldatei liegen statt im
 * Twin-Ordner (Folge des `createFolder`-Fehlers in external-jobs/storage.ts).
 *
 * Erkannt wird `<Basisname>.md` und `<Basisname>.<zusatz>.md` — also genau die
 * Artefakt-Namensform (`.de.md`, `.<template>.de.md`). Andere Markdown-Dateien
 * bleiben unangetastet.
 */
/** Zeitstempel als Zahl; null wenn nicht auswertbar (dann NIE loeschen). */
function toTime(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime()
    return Number.isFinite(t) ? t : null
  }
  return null
}

function findStrayArtifacts(itemsInFolder: StorageItem[], sourceName: string): StorageItem[] {
  const lastDot = sourceName.lastIndexOf('.')
  const baseName = lastDot > 0 ? sourceName.slice(0, lastDot) : sourceName
  if (!baseName) return []

  return itemsInFolder.filter((i) => {
    if (i.type !== 'file') return false
    const n = i.metadata.name
    if (!n.toLowerCase().endsWith('.md')) return false
    if (n === sourceName) return false
    return n === `${baseName}.md` || n.startsWith(`${baseName}.`)
  })
}

/**
 * Laeuft den Baum ab und sammelt alle Legacy-Twin-Ordner.
 * Twin-Ordner werden NICHT rekursiv betreten (ihre Inhalte sind Artefakte).
 */
async function collectCandidates(
  provider: StorageProvider,
  folderId: string,
  folderPath: string,
  out: Candidate[],
): Promise<void> {
  const items = await provider.listItemsById(folderId)
  const namesHere = new Set(items.map((i) => i.metadata.name))
  // Nur Dateinamen: Ein Twin-Ordner heisst `.<Quelldatei>` und die Quelldatei
  // liegt DANEBEN. Ohne diese Bedingung wuerde das Skript auch fremde
  // Punkt-Ordner erwischen (`.obsidian`, `.ck-meta`) und deren Werkzeuge brechen.
  const fileNamesHere = new Set(items.filter((i) => i.type === 'file').map((i) => i.metadata.name))

  for (const item of items) {
    if (item.type !== 'folder') continue
    const name = item.metadata.name

    // Twin-Ordner erkennen — Legacy (`.`) UND bereits normalisiert (`_`).
    // Bereits normalisierte werden nicht umbenannt, koennen aber weiterhin
    // verirrte Artefakte neben sich haben (Nachlauf nach der Umbenennung).
    const isLegacy = name.startsWith(LEGACY_PREFIX) && name.length > 1
    const isCurrent = name.startsWith(CURRENT_PREFIX) && name.length > 1

    if (isLegacy || isCurrent) {
      const sourceName = name.slice(1)
      if (!fileNamesHere.has(sourceName)) {
        // Kein Twin-Ordner (keine gleichnamige Quelldatei) -> unangetastet lassen.
        continue
      }
      const strays = findStrayArtifacts(items, sourceName)
      // Bereits normalisiert und nichts einzusammeln -> nichts zu tun.
      if (isCurrent && strays.length === 0) continue

      const newName = generateShadowTwinFolderName(sourceName)
      out.push({
        folder: item,
        parentPath: folderPath,
        oldName: name,
        newName,
        // Nur Legacy-Ordner werden umbenannt; bei `_` ist newName === name.
        collision: isLegacy && namesHere.has(newName),
        strays,
      })
      continue // Twin-Ordner nicht betreten
    }

    await collectCandidates(provider, item.id, `${folderPath}/${name}`, out)
  }
}

async function main(): Promise<void> {
  const { user, library, limit, apply, deleteSuperseded } = parseArgs(process.argv.slice(2))
  const provider = await getServerProvider(user, library)

  console.log(apply ? '=== ANWENDEN (Ordner werden umbenannt) ===' : '=== TROCKENLAUF (keine Aenderung) ===')

  const candidates: Candidate[] = []
  await collectCandidates(provider, 'root', '', candidates)

  const collisions = candidates.filter((c) => c.collision)
  const renamable = candidates.filter((c) => !c.collision)
  const selected = limit ? renamable.slice(0, limit) : renamable

  console.log(`\nGefundene Legacy-Ordner (Praefix "."): ${candidates.length}`)
  console.log(`Davon umzubenennen (Legacy-Praefix): ${renamable.filter((c) => c.oldName !== c.newName).length}`)
  if (collisions.length > 0) {
    console.log(`Davon KOLLISION (Zielname existiert bereits, uebersprungen): ${collisions.length}`)
    for (const c of collisions.slice(0, 10)) {
      console.log(`  ! ${c.parentPath}/${c.oldName}  ->  ${c.newName} EXISTIERT`)
    }
    if (collisions.length > 10) console.log(`  … und ${collisions.length - 10} weitere`)
  }
  if (limit && renamable.length > selected.length) {
    console.log(`Begrenzt auf ${selected.length} (via --limit); ${renamable.length - selected.length} bleiben uebrig.`)
  }

  const strayTotal = selected.reduce((sum, c) => sum + c.strays.length, 0)
  console.log(`\nVerirrte Artefakte neben der Quelldatei (werden in den Twin-Ordner verschoben): ${strayTotal}`)

  console.log('\nBeispiele:')
  for (const c of selected.slice(0, 8)) {
    console.log(`  ${c.parentPath}/${c.oldName}\n    -> ${c.newName}`)
    for (const s of c.strays) console.log(`       + verschiebe: ${s.metadata.name}`)
  }
  if (selected.length > 8) console.log(`  … und ${selected.length - 8} weitere`)

  if (!apply) {
    console.log('\nTrockenlauf beendet. Zum Anwenden dasselbe Kommando mit --apply wiederholen.')
    return
  }

  let renamed = 0
  let moved = 0
  let deleted = 0
  const failures: Array<{ path: string; message: string }> = []
  for (const c of selected) {
    // Bereits normalisierte Ordner (oldName === newName) nur zum Einsammeln.
    if (c.oldName !== c.newName) {
      try {
        await provider.renameItem(c.folder.id, c.newName)
        renamed++
      } catch (e) {
        // Kein stiller Fallback: jeder Fehlschlag wird gemeldet und am Ende gezaehlt.
        failures.push({ path: `${c.parentPath}/${c.oldName}`, message: e instanceof Error ? e.message : String(e) })
        continue // Ohne umbenannten Ordner keine Artefakte verschieben
      }
    }

    // Verirrte Artefakte in den (jetzt normalisierten) Twin-Ordner holen.
    if (c.strays.length > 0) {
      let existingNames: Map<string, StorageItem>
      try {
        const inside = await provider.listItemsById(c.folder.id)
        existingNames = new Map(inside.map((i) => [i.metadata.name, i]))
      } catch (e) {
        failures.push({ path: `${c.parentPath}/${c.newName}`, message: `Inhalt nicht lesbar: ${e instanceof Error ? e.message : String(e)}` })
        continue
      }
      for (const stray of c.strays) {
        const name = stray.metadata.name
        const inTwin = existingNames.get(name)
        if (inTwin) {
          // Gleichnamiges Artefakt liegt schon drin — NIE ueberschreiben.
          const twinTime = toTime(inTwin.metadata.modifiedAt)
          const strayTime = toTime(stray.metadata.modifiedAt)
          const twinIsNewerOrEqual = twinTime !== null && strayTime !== null && twinTime >= strayTime

          if (deleteSuperseded && twinIsNewerOrEqual) {
            try {
              await provider.deleteItem(stray.id)
              deleted++
            } catch (e) {
              failures.push({ path: `${c.parentPath}/${name}`, message: `Loeschen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` })
            }
          } else if (twinIsNewerOrEqual) {
            failures.push({ path: `${c.parentPath}/${name}`, message: 'uebersprungen: Twin-Ordner hat aktuellere Fassung (mit --delete-superseded loeschbar)' })
          } else {
            // Verirrte Datei ist JUENGER — nie automatisch anfassen.
            failures.push({ path: `${c.parentPath}/${name}`, message: 'uebersprungen: verirrte Datei ist neuer als die im Twin-Ordner' })
          }
          continue
        }
        try {
          await provider.moveItem(stray.id, c.folder.id)
          moved++
        } catch (e) {
          failures.push({ path: `${c.parentPath}/${name}`, message: e instanceof Error ? e.message : String(e) })
        }
      }
    }

    if (renamed % 25 === 0) console.log(`  … ${renamed}/${selected.length} Ordner, ${moved} Artefakte verschoben`)
  }

  console.log(`\nUmbenannt: ${renamed}/${selected.length}`)
  console.log(`Artefakte verschoben: ${moved}/${strayTotal}`)
  if (deleteSuperseded) console.log(`Veraltete Duplikate geloescht: ${deleted}`)
  if (failures.length > 0) {
    console.log(`Nicht verarbeitet: ${failures.length}`)
    for (const f of failures.slice(0, 15)) console.log(`  ! ${f.path}: ${f.message}`)
    if (failures.length > 15) console.log(`  … und ${failures.length - 15} weitere`)
    process.exitCode = 1
  }
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error('[normalize-twins] Fehler:', e instanceof Error ? e.message : e)
  process.exit(1)
})
