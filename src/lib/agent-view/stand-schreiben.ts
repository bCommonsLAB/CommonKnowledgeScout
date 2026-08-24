/**
 * @fileoverview Stand-Schreiben (F8, Werkbank W7): die eine Schreiboperation.
 *
 * @description
 * Fuehrt die Schutzstufen aus `stand-plan.ts` in §F8-Reihenfolge aus und
 * schreibt dann NUR `bearbeitungsstand` + `bearbeitungsstand_seit` ueber den
 * gemeinsamen Frontmatter-Patch (`patchFrontmatter`, Single-Serializer,
 * flaches snake_case) — Body und unbekannte Felder bleiben unangetastet.
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

import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
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
import type { Bearbeitungsstand, CoverageGap } from './types'

/** Aussenzugriffe der Schreiboperation — in Tests vollstaendig ersetzbar. */
export interface StandSchreibenPorts {
  /** Inhalt des Ordners; wirft den Provider-Fehler bei unbekannter Id. */
  listFolder(folderId: string): Promise<StorageItem[]>
  /** Roh-Markdown der Datei (inklusive Frontmatter). */
  readText(fileId: string): Promise<string>
  deleteFile(fileId: string): Promise<void>
  uploadMarkdown(folderId: string, name: string, content: string): Promise<{ fileId: string }>
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
 * Ersetzt das `_INDEX.md` durch die gepatchte Fassung. Schlaegt der Upload
 * nach dem Loeschen fehl, wird das Original zurueckgeschrieben — der Fehler
 * bleibt in JEDEM Fall ein Fehler und benennt den Wiederherstellungs-Stand.
 */
async function ersetzeIndex(
  ports: StandSchreibenPorts,
  folderId: string,
  indexFileId: string,
  original: string,
  gepatcht: string,
): Promise<void> {
  await ports.deleteFile(indexFileId)
  try {
    await ports.uploadMarkdown(folderId, INDEX_FILE_NAME, gepatcht)
  } catch (uploadFehler) {
    const grund = uploadFehler instanceof Error ? uploadFehler.message : String(uploadFehler)
    try {
      await ports.uploadMarkdown(folderId, INDEX_FILE_NAME, original)
      throw new Error(`Stand-Schreiben fehlgeschlagen (${grund}) — Original-_INDEX.md wiederhergestellt.`)
    } catch (restoreFehler) {
      if (restoreFehler instanceof Error && restoreFehler.message.startsWith('Stand-Schreiben fehlgeschlagen')) {
        throw restoreFehler
      }
      const restoreGrund = restoreFehler instanceof Error ? restoreFehler.message : String(restoreFehler)
      throw new Error(
        `Stand-Schreiben fehlgeschlagen (${grund}) UND Wiederherstellung fehlgeschlagen (${restoreGrund}) — ` +
          `_INDEX.md fehlt jetzt im Ordner ${folderId}!`,
      )
    }
  }
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
  if (!index) throw new KeinIndexError(request.folderId)

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

  const gepatcht = patchFrontmatter(original, baueStandPatch(request.stand, args.now()))
  await ersetzeIndex(ports, request.folderId, index.id, original, gepatcht)

  const gelesen = readBearbeitungsstand(parseFrontmatter(gepatcht).meta)
  if (gelesen.bearbeitungsstand === null) {
    throw new Error(`Gepatchtes _INDEX.md traegt keinen lesbaren Stand — ${gelesen.error ?? 'unbekannt'}`)
  }
  return {
    bearbeitungsstand: gelesen.bearbeitungsstand,
    bearbeitungsstandSeit: gelesen.bearbeitungsstandSeit,
  }
}
