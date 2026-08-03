/**
 * Normalisiert Shadow-Twin-Ordner einer Library vom Legacy-Praefix `.` auf `_`.
 *
 * Hintergrund: `generateShadowTwinFolderName` erzeugt heute `_Quelle.pdf`.
 * Aeltere Libraries tragen `.Quelle.pdf`. Bisher werden Alt-Ordner beim SUCHEN
 * nur toleriert (`generateShadowTwinFolderNameVariants`) — umbenannt hat sie nie
 * jemand. Dieses Skript zieht den Bestand nach, damit die Legacy-Toleranz im
 * Code danach entfallen kann.
 *
 * Read + Rename (kein Loeschen, kein Inhalt wird angefasst). TROCKENLAUF ist
 * Standard: ohne `--apply` wird nur berichtet, was passieren wuerde.
 *
 * Aufruf:
 *   node --import tsx scripts/normalize-shadow-twin-folders.ts \
 *     --user <owner-email> --library <library-id> [--limit N] [--apply]
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
  return { user, library, limit, apply: argv.includes('--apply') }
}

interface Candidate {
  folder: StorageItem
  parentPath: string
  oldName: string
  newName: string
  /** Ein Ordner mit dem Zielnamen existiert bereits — Umbenennen wuerde kollidieren. */
  collision: boolean
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

    if (name.startsWith(LEGACY_PREFIX) && name.length > 1) {
      const sourceName = name.slice(LEGACY_PREFIX.length)
      if (!fileNamesHere.has(sourceName)) {
        // Kein Twin-Ordner (keine gleichnamige Quelldatei) -> unangetastet lassen.
        continue
      }
      const newName = generateShadowTwinFolderName(sourceName)
      out.push({
        folder: item,
        parentPath: folderPath,
        oldName: name,
        newName,
        collision: namesHere.has(newName),
      })
      continue // Twin-Ordner nicht betreten
    }

    if (name.startsWith(CURRENT_PREFIX)) continue // bereits normalisiert

    await collectCandidates(provider, item.id, `${folderPath}/${name}`, out)
  }
}

async function main(): Promise<void> {
  const { user, library, limit, apply } = parseArgs(process.argv.slice(2))
  const provider = await getServerProvider(user, library)

  console.log(apply ? '=== ANWENDEN (Ordner werden umbenannt) ===' : '=== TROCKENLAUF (keine Aenderung) ===')

  const candidates: Candidate[] = []
  await collectCandidates(provider, 'root', '', candidates)

  const collisions = candidates.filter((c) => c.collision)
  const renamable = candidates.filter((c) => !c.collision)
  const selected = limit ? renamable.slice(0, limit) : renamable

  console.log(`\nGefundene Legacy-Ordner (Praefix "."): ${candidates.length}`)
  console.log(`Davon umbenennbar: ${renamable.length}`)
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

  console.log('\nBeispiele:')
  for (const c of selected.slice(0, 10)) {
    console.log(`  ${c.parentPath}/${c.oldName}\n    -> ${c.newName}`)
  }
  if (selected.length > 10) console.log(`  … und ${selected.length - 10} weitere`)

  if (!apply) {
    console.log('\nTrockenlauf beendet. Zum Anwenden dasselbe Kommando mit --apply wiederholen.')
    return
  }

  let renamed = 0
  const failures: Array<{ path: string; message: string }> = []
  for (const c of selected) {
    try {
      await provider.renameItem(c.folder.id, c.newName)
      renamed++
      if (renamed % 25 === 0) console.log(`  … ${renamed}/${selected.length} umbenannt`)
    } catch (e) {
      // Kein stiller Fallback: jeder Fehlschlag wird gemeldet und am Ende gezaehlt.
      failures.push({ path: `${c.parentPath}/${c.oldName}`, message: e instanceof Error ? e.message : String(e) })
    }
  }

  console.log(`\nUmbenannt: ${renamed}/${selected.length}`)
  if (failures.length > 0) {
    console.log(`Fehlgeschlagen: ${failures.length}`)
    for (const f of failures.slice(0, 10)) console.log(`  ! ${f.path}: ${f.message}`)
    process.exitCode = 1
  }
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error('[normalize-twins] Fehler:', e instanceof Error ? e.message : e)
  process.exit(1)
})
