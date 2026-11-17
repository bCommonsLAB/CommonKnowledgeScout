/**
 * @fileoverview Quellen einer Sammeldatei fuer den Ingest-Anhang im Storage finden.
 *
 * Der Twin fuehrt `_source_files` als blosse Dateinamen. Die Pfade stehen nur in
 * der Sammeldatei selbst (`pdfs/karte.pdf`, `videos/film.md`). Liegt eine Quelle
 * in einem Unterordner, findet die Namenssuche im Ordner der Sammeldatei sie
 * nicht — der Ingest brach dann mit „nicht im Storage gefunden" ab, obwohl die
 * Datei da ist (Befund 17.11.2026: kein Dokument mit Quellen in Unterordnern
 * liess sich mehr indexieren).
 *
 * Regel: Zuerst die Namenssuche wie bisher. Was dabei offen bleibt, wird ueber
 * den Pfad aufgeloest, den die Sammeldatei fuer GENAU diesen Dateinamen nennt.
 * Nennt sie ihn nicht, bleibt die Quelle ungeloest; nennt sie ihn mehrfach, ist
 * er mehrdeutig. Beides meldet der Aufrufer als Fehler — geraten wird nichts.
 */

import type { StorageProvider } from '@/lib/storage/types'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'
import { parseCompositeSourceEntry, type ParsedCompositeSourceEntry } from '@/lib/creation/composite-source-entry'
import { findCompositeSourceItems, type CompositeSourceItem } from '@/lib/creation/composite-source-path'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

export interface AnhangQuellenArgs {
  provider: StorageProvider
  /** Storage-Id und Name der ingestierten Sammeldatei. */
  sourceId: string
  sourceName: string
  /** Ordner der Sammeldatei — Pfade in `_source_files` sind relativ dazu. */
  parentId: string
}

export interface AnhangQuellen {
  /** Je `raw`-Eintrag das gefundene Item. */
  items: Map<string, CompositeSourceItem>
  /** `raw`-Eintraege, deren Dateiname in der Sammeldatei unter mehreren Pfaden steht. */
  mehrdeutig: string[]
}

/** Die Eintraege der Sammeldatei, die einen Pfad tragen. Nicht lesbar = Fehler, kein leeres Ergebnis. */
async function pfadEintraegeDerSammeldatei(args: AnhangQuellenArgs): Promise<ParsedCompositeSourceEntry[]> {
  let text: string
  try {
    const binary = await args.provider.getBinary(args.sourceId)
    text = await binary.blob.text()
  } catch (error) {
    const grund = error instanceof Error ? error.message : String(error)
    throw new Error(`Anhang fuer Ingestion: Sammeldatei "${args.sourceName}" nicht lesbar — Pfade ihrer Quellen unbekannt (${grund})`)
  }
  return parseCompositeSourceFilesFromMeta(parseFrontmatter(text).meta)
    .map(parseCompositeSourceEntry)
    .filter((e) => typeof e.relativePath === 'string' && e.relativePath.length > 0)
}

/**
 * Loest die Eintraege auf: Namenssuche, dann der Pfad aus der Sammeldatei. Die
 * Sammeldatei wird nur gelesen, wenn die Namenssuche etwas offen laesst.
 */
export async function findeAnhangQuellen(
  args: AnhangQuellenArgs,
  entries: ParsedCompositeSourceEntry[],
): Promise<AnhangQuellen> {
  const items = await findCompositeSourceItems(args.provider, args.parentId, entries)
  const offen = entries.filter((e) => !items.has(e.raw) && !e.relativePath)
  // Nur eine Markdown-Datei kann eine Sammeldatei mit Pfaden sein.
  if (offen.length === 0 || !args.sourceName.toLowerCase().endsWith('.md')) return { items, mehrdeutig: [] }

  const mitPfad = await pfadEintraegeDerSammeldatei(args)
  const mehrdeutig: string[] = []
  for (const entry of offen) {
    const kandidaten = mitPfad.filter((p) => p.name === entry.name)
    if (kandidaten.length > 1) {
      mehrdeutig.push(entry.raw)
      continue
    }
    const kandidat = kandidaten[0]
    if (!kandidat) continue
    const item = (await findCompositeSourceItems(args.provider, args.parentId, [kandidat])).get(kandidat.raw)
    if (item) items.set(entry.raw, item)
  }
  return { items, mehrdeutig }
}
