/**
 * @fileoverview Stand-Schreiben (F8, Werkbank W7): die eine Schreiboperation.
 *
 * @description
 * Fuehrt die Schutzstufen aus `stand-plan.ts` in §F8-Reihenfolge aus und
 * schreibt dann NUR `bearbeitungsstand` + `bearbeitungsstand_seit` — seit dem
 * W7-Live-Test zeilen-chirurgisch (`stand-zeilen-patch.ts`): fremde Zeilen
 * des von Hand gepflegten `_INDEX.md` behalten Byte fuer Byte ihre
 * Schreibweise, mit Ruecklese-Pruefung vor dem Schreiben.
 *
 * Der Storage kennt kein Update-in-place: Ersetzen heisst loeschen + neu
 * hochladen (Muster `regenerate-sichten.ts`; deshalb ist die neue fileId
 * laut §F8 unerheblich — die folderId bleibt der Schluessel). Weil das
 * `_INDEX.md` MENSCHEN-Inhalt ist, wird bei einem Upload-Fehler nach dem
 * Loeschen die Original-Datei wiederhergestellt — und beides LAUT gemeldet,
 * nie still (`no-silent-fallbacks.mdc`).
 *
 * Aussenzugriffe laufen ueber Ports — ohne Storage unit-testbar
 * (`storage-abstraction.mdc`). Der Teilbaum-Scan der Stufe 4 kommt als
 * lazy Port herein und wird NIE persistiert (§F10: Rechnung ≠ Cache).
 *
 * @module agent-view
 */

import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { StorageItem } from '@/lib/storage/types'
import { INDEX_FILE_NAME } from './archive-scan'
import { readBearbeitungsstand } from './bearbeitungsstand'
import { OrdnerNichtGefundenError, istStorageNotFound } from './bericht-laden'
import {
  KeinIndexError,
  baueStandPatch,
  brauchtPrecheck,
  pruefeBereitschaft,
  pruefeReportVeraltet,
  pruefeStandGeaendert,
  type StandRequest,
} from './stand-plan'
import { patchStandZeilen } from './stand-zeilen-patch'
import type { Bearbeitungsstand, CoverageGap } from './types'

/** Aussenzugriffe der Schreiboperation — in Tests vollstaendig ersetzbar. */
export interface StandSchreibenPorts {
  /** Inhalt des Ordners; wirft den Provider-Fehler bei unbekannter Id. */
  listFolder(folderId: string): Promise<StorageItem[]>
  /** Roh-Markdown der Datei (inklusive Frontmatter). */
  readText(fileId: string): Promise<string>
  deleteFile(fileId: string): Promise<void>
  uploadMarkdown(folderId: string, name: string, content: string): Promise<{ fileId: string }>
  /**
   * Anzeigename des Vorhabens-Ordners — nur fuer die `kein_index`-Meldung
   * (sie richtet sich an einen Menschen, nicht an eine Id) und deshalb lazy.
   */
  folderName(): Promise<string>
}

export interface StandSchreibenArgs {
  request: StandRequest
  /** `generatedAt` des GESPEICHERTEN Reports; null = keiner vorhanden (Stufe 3). */
  gespeicherterGeneratedAt: string | null
  /** Stufe 4: frischer, UNGESPEICHERTER Teilbaum-Scan — lazy, nur bei Bedarf. */
  scanTeilbaum(): Promise<readonly CoverageGap[]>
  /** Zeitquelle (Tests injizieren eine feste Uhr). */
  now(): string
}

export interface StandErgebnis {
  bearbeitungsstand: Bearbeitungsstand
  /** ISO wie vom Reader gelesen (Tagesende des Server-Datums). */
  bearbeitungsstandSeit: string | null
}

/**
 * Schreibt die gepatchte Fassung des `_INDEX.md` — als INHALTS-Update, nicht
 * als Loeschen und Neuanlegen.
 *
 * Befund 27.08.2026 (Cowork): Das fruehere `deleteFile` + `uploadMarkdown`
 * gab der Datei eine NEUE itemId. Jede gespeicherte Id, die auf das
 * `_INDEX.md` zeigte, lief danach in `NOT_FOUND` — KnowledgeScout entwertete
 * seine eigenen Verweise. Dazu existierte die Datei zwischen beiden Schritten
 * nicht; ein Absturz genau dort verlor sie.
 *
 * `uploadMarkdown` ueberschreibt bei allen Providern namensgleich im selben
 * Ordner (OneDrive PUT :/content, fs.writeFile, WebDAV overwrite) — dieselbe
 * Korrektur, die der Spiegel-Write schon traegt. Die Wiederherstellungs-Logik
 * entfaellt damit ersatzlos: Schlaegt der Upload fehl, steht das Original
 * unveraendert da, weil nie etwas geloescht wurde.
 */
export async function ersetzeIndex(
  ports: StandSchreibenPorts,
  folderId: string,
  gepatcht: string,
): Promise<void> {
  await ports.uploadMarkdown(folderId, INDEX_FILE_NAME, gepatcht)
}

/**
 * Setzt den erklaerten Stand eines Vorhabens nach §F8: Schutzstufen 1–4 in
 * Reihenfolge, dann der Frontmatter-Patch. Bei jedem Befund wird NICHTS
 * geschrieben; alle Fehler sind typisiert (`stand-plan.ts`).
 */
export async function setzeStand(
  args: StandSchreibenArgs,
  ports: StandSchreibenPorts,
): Promise<StandErgebnis> {
  const { request } = args

  let items: StorageItem[]
  try {
    items = await ports.listFolder(request.folderId)
  } catch (error) {
    if (istStorageNotFound(error)) {
      throw new OrdnerNichtGefundenError(`Ordner nicht gefunden: ${request.folderId}`)
    }
    throw error
  }

  // Stufe 1: Matching EXAKT wie im Archiv-Scan (INDEX_FILE_NAME, kein Drift).
  const index = items.find((item) => item.type === 'file' && item.metadata.name === INDEX_FILE_NAME)
  if (!index) throw new KeinIndexError(await ports.folderName())

  // Stufe 2: der Storage ist die Wahrheit ueber den aktuell erklaerten Stand.
  const original = await ports.readText(index.id)
  const aktuell = readBearbeitungsstand(parseFrontmatter(original).meta)
  pruefeStandGeaendert(aktuell.bearbeitungsstand, request.erwarteterStand)

  // Stufe 3: der Client muss auf dem gespeicherten Report urteilen.
  pruefeReportVeraltet(request.reportGeneratedAt, args.gespeicherterGeneratedAt)

  // Stufe 4: nur die Abnahme wird gegen das frische Ist-Buch beurkundet.
  if (brauchtPrecheck(request)) {
    pruefeBereitschaft(await args.scanTeilbaum())
  }

  // Zeilen-chirurgisch statt patchFrontmatter: das _INDEX.md ist von Hand
  // gepflegt, fremde Zeilen behalten ihre Schreibweise (Test-Befund 24.08.).
  // Ruecklese-Pruefung VOR dem Schreiben: misslingt die Chirurgie, wird
  // nichts geloescht und nichts hochgeladen.
  const gepatcht = patchStandZeilen(original, baueStandPatch(request.stand, args.now()))
  const gelesen = readBearbeitungsstand(parseFrontmatter(gepatcht).meta)
  if (gelesen.bearbeitungsstand !== request.stand) {
    throw new Error(
      `Gepatchtes _INDEX.md traegt nicht den gesetzten Stand „${request.stand}" — ` +
        `abgebrochen, nichts geschrieben (${gelesen.error ?? 'Frontmatter unlesbar'})`,
    )
  }
  await ersetzeIndex(ports, request.folderId, gepatcht)

  return {
    bearbeitungsstand: gelesen.bearbeitungsstand,
    bearbeitungsstandSeit: gelesen.bearbeitungsstandSeit,
  }
}
