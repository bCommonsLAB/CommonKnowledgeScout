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
 * Wunschliste 5, B3a (09.09.2026): Der Ordner muss kein Vorhaben mehr sein.
 * Fehlt dort ein `_INDEX.md`, legt `indexAnlegen: true` eines nach Vorlage an
 * — sonst bliebe die feinste Themenaufloesung ein Wert je Vorhaben (in
 * `24.09 KnowledgeScout`: ein Index bei 53 Ereignisordnern).
 *
 * Aussenzugriffe ueber Ports — ohne Storage unit-testbar.
 *
 * @module agent-view
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { StorageItem } from '@/lib/storage/types'
import { INDEX_FILE_NAME } from './archive-scan'
import { OrdnerNichtGefundenError, istStorageNotFound } from './bericht-laden'
import { baueIndexVorlage } from './index-vorlage'
import { asList } from './sichten/bericht-lesen'
import { ersetzeIndex, type StandSchreibenPorts } from './stand-schreiben'
import { KeinIndexError } from './stand-plan'
import { patchStandZeilen } from './stand-zeilen-patch'

/** Ein Thema ist unbrauchbar — der Fehler nennt den Grund, nichts wird geschrieben. */
export class ThemaUngueltigError extends Error {
  readonly code = 'thema_ungueltig' as const
}

/** Der Ordner traegt andere Themen, als der Aufrufer sah — nichts geschrieben. */
export class ThemenWiderspruchError extends Error {
  readonly code = 'themen_widerspruch' as const
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
  /** B3a: Das `_INDEX.md` gab es nicht und wurde nach Vorlage angelegt. */
  indexAngelegt: boolean
}

export interface ThemenOptionen {
  /**
   * Riegel gegen konkurrierende Schreiber (MCP-Bruecke, analog
   * `erwarteterStand` beim Stand): die Themen, die der Aufrufer aktuell am
   * Vorhaben sieht — explizit `null`, wenn der Ordner keine deklariert.
   * Weicht der Stand im Storage ab: {@link ThemenWiderspruchError}, nichts
   * geschrieben. Die UI (Mensch klickt auf dem sichtbaren Stand) laesst die
   * Optionen weg.
   */
  erwarteteThemen: readonly string[] | null
  /**
   * B3a: Fehlt das `_INDEX.md`, eines nach Vorlage anlegen statt
   * {@link KeinIndexError} zu werfen. Bewusst ein SCHALTER und keine
   * Vorgabe: Eine Datei entsteht nur, wenn der Aufrufer sie will —
   * `no-silent-fallbacks.md`. Ohne ihn bleibt das Verhalten von A6.
   */
  indexAnlegen?: boolean
}

/** Riegel: gelesener Ist-Stand gegen die Sicht des Aufrufers (reihenfolgetreu). */
function pruefeErwarteteThemen(aktuell: readonly string[], erwartet: readonly string[] | null): void {
  const gesehen = (erwartet ?? []).map((thema) => thema.trim())
  if (JSON.stringify(aktuell) === JSON.stringify(gesehen)) return
  const zeige = (liste: readonly string[]) => (liste.length === 0 ? 'keine Themen' : `[${liste.join(', ')}]`)
  throw new ThemenWiderspruchError(
    `Der Ordner traegt aktuell ${zeige(aktuell)}, der Aufruf erwartete ${zeige(gesehen)} — ` +
      'nichts geschrieben. Stand neu lesen und mit den gesehenen Themen erneut aufrufen.',
  )
}

/**
 * Setzt die gepflegten Themen EINES Ordners: `_INDEX.md` lesen, `themen:`
 * zeilen-chirurgisch ersetzen (JSON-Flow-Liste), ruecklesen, ersetzen.
 *
 * Seit B3 ist der Ordner nicht mehr auf die Vorhabensebene beschraenkt —
 * jeder Ordner darf Themen tragen, damit das Themenregister in den
 * Ereignisordner hinein zeigen kann statt nur bis zum Vorhaben. Ohne
 * `_INDEX.md` gibt es dort noch keine Selbstdeklaration: Standard bleibt
 * {@link KeinIndexError}, `indexAnlegen: true` legt eines nach Vorlage an
 * (siehe `index-vorlage.ts` — ohne `bearbeitungsstand`).
 */
export async function setzeThemen(
  folderId: string,
  themen: readonly string[],
  ports: StandSchreibenPorts,
  optionen?: ThemenOptionen,
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
  const indexAngelegt = index === undefined
  if (indexAngelegt && optionen?.indexAnlegen !== true) {
    throw new KeinIndexError(
      await ports.folderName(),
      'themen_setzen legt nur mit indexAnlegen: true eines an (Vorlage ohne bearbeitungsstand — ' +
        'der bleibt stand_setzen). Ohne Index kann der Ordner kein Thema tragen.',
    )
  }

  // Die Vorlage laeuft durch DENSELBEN Patch- und Ruecklese-Weg wie eine
  // bestehende Datei — ein Schreibweg, ein Serialisierer, kein Drift.
  const original = index ? await ports.readText(index.id) : baueIndexVorlage(await ports.folderName())
  if (optionen !== undefined) {
    pruefeErwarteteThemen(asList(parseFrontmatter(original).meta.themen), optionen.erwarteteThemen)
  }
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

  await ersetzeIndex(ports, folderId, gepatcht)
  return { themen: geprueft, indexAngelegt }
}
