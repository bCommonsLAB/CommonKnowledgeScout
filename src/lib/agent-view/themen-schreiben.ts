/**
 * @fileoverview Themen-Schreiben (Welle A6): gepflegte Themen ins _INDEX.md.
 *
 * @description
 * Schreibt das von Hand gepflegte Feld `themen:` (flache YAML-Liste) in das
 * `_INDEX.md` eines Vorhabens — mit DERSELBEN Zeilen-Chirurgie wie das
 * Stand-Schreiben (`stand-zeilen-patch.ts`): fremde Zeilen bleiben Byte fuer
 * Byte stehen. Der Wert ist eine UNQUOTED Flow-Liste (`themen: [a, b]`) —
 * exakt die Schreibweise, die der hauseigene Frontmatter-Parser rundreist
 * (Quotes blieben im Wert stehen, Test-Befund A6); dafuer sind Komma und
 * eckige Klammern im Themennamen benannt verboten. Eine handgeschriebene
 * Block-Liste unter `themen:` wird vorher auf die eine Zeile eingedampft,
 * damit keine verwaisten `- eintrag`-Zeilen zurueckbleiben.
 *
 * Vor dem Schreiben wird das Ergebnis gegen den echten Parser rueckgelesen;
 * misslingt die Chirurgie, wird NICHTS geschrieben. Ersetzen + Wieder-
 * herstellung laufen ueber {@link ersetzeIndex} (Menschen-Datei, laut).
 *
 * Aussenzugriffe ueber Ports — ohne Storage unit-testbar.
 *
 * @module agent-view
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { StorageItem } from '@/lib/storage/types'
import { INDEX_FILE_NAME } from './archive-scan'
import { OrdnerNichtGefundenError, istStorageNotFound } from './bericht-laden'
import { asList } from './sichten/bericht-lesen'
import { ersetzeIndex, type StandSchreibenPorts } from './stand-schreiben'
import { KeinIndexError } from './stand-plan'
import { patchStandZeilen } from './stand-zeilen-patch'

/** Ein Thema ist unbrauchbar — der Fehler nennt den Grund, nichts wird geschrieben. */
export class ThemaUngueltigError extends Error {
  readonly code = 'thema_ungueltig' as const
}

/**
 * Prueft und normalisiert die Themenliste: getrimmt, nicht leer, einzeilig,
 * ohne Duplikate — und ohne Komma/eckige Klammern (die Trennzeichen der
 * unquoted Flow-Liste). Ungueltiges wird BENANNT zurueckgewiesen — kein
 * stilles Wegfiltern (`no-silent-fallbacks.mdc`).
 */
export function pruefeThemen(themen: readonly string[]): string[] {
  const geprueft: string[] = []
  for (const roh of themen) {
    const thema = roh.trim()
    if (thema === '') throw new ThemaUngueltigError('Leeres Thema — bitte einen Namen angeben.')
    if (/[\r\n]/.test(roh)) throw new ThemaUngueltigError(`Thema mit Zeilenumbruch: ${JSON.stringify(roh)}`)
    if (/[,\[\]]/.test(thema)) {
      throw new ThemaUngueltigError(`Thema mit Komma oder eckiger Klammer: „${thema}" — die Zeichen trennen die Liste im Frontmatter.`)
    }
    if (geprueft.includes(thema)) throw new ThemaUngueltigError(`Doppeltes Thema: „${thema}"`)
    geprueft.push(thema)
  }
  return geprueft
}

/**
 * Dampft eine handgeschriebene Block-Liste unter `themen:` im Frontmatter
 * auf die nackte `themen:`-Zeile ein, damit der Zeilen-Patch sie ersetzen
 * kann, ohne `- eintrag`-Zeilen zu verwaisen. Andere Bloecke bleiben stehen.
 */
export function eindampfeThemenBlockliste(markdown: string): string {
  const treffer = markdown.match(/^---(\r?\n)([\s\S]*?)(\r?\n)---(\r?\n|$)/)
  if (!treffer) return markdown
  const blockStart = 3 + treffer[1].length
  const block = treffer[2]
  const eingedampft = block.replace(/^themen:[ \t]*(?:\r?\n[ \t]+-[^\r\n]*)+/m, 'themen:')
  if (eingedampft === block) return markdown
  return markdown.slice(0, blockStart) + eingedampft + markdown.slice(blockStart + block.length)
}

export interface ThemenErgebnis {
  themen: string[]
}

/**
 * Setzt die gepflegten Themen eines Vorhabens: `_INDEX.md` lesen, `themen:`
 * zeilen-chirurgisch ersetzen (JSON-Flow-Liste), ruecklesen, ersetzen.
 * Ohne `_INDEX.md` gibt es keine Selbstdeklaration — {@link KeinIndexError},
 * dieselbe Regel wie beim Stand (kein automatisch erfundenes Index-Geruest).
 */
export async function setzeThemen(
  folderId: string,
  themen: readonly string[],
  ports: StandSchreibenPorts,
): Promise<ThemenErgebnis> {
  const geprueft = pruefeThemen(themen)

  let items: StorageItem[]
  try {
    items = await ports.listFolder(folderId)
  } catch (error) {
    if (istStorageNotFound(error)) {
      throw new OrdnerNichtGefundenError(`Ordner nicht gefunden: ${folderId}`)
    }
    throw error
  }

  const index = items.find((item) => item.type === 'file' && item.metadata.name === INDEX_FILE_NAME)
  if (!index) throw new KeinIndexError(await ports.folderName())

  const original = await ports.readText(index.id)
  // Unquoted Flow-Liste (EINE Zeile) — die Schreibweise, die Scan-Parser
  // und Obsidian gleichermassen lesen; verbotene Zeichen prueft pruefeThemen.
  const wert = `[${geprueft.join(', ')}]`
  const gepatcht = patchStandZeilen(eindampfeThemenBlockliste(original), { themen: wert })

  const gelesen = asList(parseFrontmatter(gepatcht).meta.themen)
  if (JSON.stringify(gelesen) !== JSON.stringify(geprueft)) {
    throw new Error(
      `Gepatchtes _INDEX.md traegt nicht die gesetzten Themen — abgebrochen, nichts geschrieben ` +
        `(gelesen: ${JSON.stringify(gelesen)}).`,
    )
  }

  await ersetzeIndex(ports, folderId, index.id, original, gepatcht)
  return { themen: geprueft }
}
