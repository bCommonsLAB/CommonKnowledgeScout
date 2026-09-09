/**
 * @fileoverview Regel `sicht_veraltet` (Wunschliste 5, B1) — pur.
 *
 * @description
 * `AKTUELL.md` und `PROJEKTE.md` in `Organisation/` sind erzeugte Sichten
 * ueber alle `BERICHT.md` der Library. Es gab `bericht_veraltet` (Bericht
 * aelter als seine Quellen) und `postfach_veraltet`, aber nichts fuer die
 * Sichten: Am 09.09.2026 wurde ein Bericht um 09:27 umgestellt, waehrend
 * `AKTUELL.md` noch vom 07.09. stammte — zwei Tage alt, alte Reihenfolge,
 * und nichts hat es gemeldet. Eine veraltete Sicht ist schaedlicher als ein
 * veralteter Bericht, weil sie als Erstes gelesen wird und Aktualitaet
 * vortaeuscht.
 *
 * Die Regel vergleicht Zeitstempel aus dem Ordner-Listing (kein Lesen): die
 * Sicht ist veraltet, wenn irgendein `BERICHT.md` der Library juenger ist.
 * Sie laeuft NUR beim Library-weiten Scan — im Teilbaum-Scope liegt der
 * juengste Bericht womoeglich ausserhalb, und „nicht veraltet" waere geraten.
 * Ohne `Organisation/` oder ohne Sichten schweigt sie: Libraries, die keine
 * Sichten erzeugen, merken nichts. Ein Sicht-Eintrag OHNE Zeitstempel ist ein
 * Befund, kein Freispruch (`no-silent-fallbacks.md`).
 *
 * Aufloesung ist immer dieselbe: `sichten_regenerieren`.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import { createGap } from './gap-registry'
import { newest } from './coverage-inputs'
import { AKTUELL_FILE_NAME, PROJEKTE_FILE_NAME, SICHTEN_ORDNER } from './sichten/types'
import type { CoverageGap } from './types'

/** Die erzeugten Sichten, die diese Regel ueberwacht. */
export const SICHT_DATEINAMEN: readonly string[] = [AKTUELL_FILE_NAME, PROJEKTE_FILE_NAME]

export interface SichtRegelArgs {
  folders: readonly ArchiveFolderNode[]
  /** Teilbaum-Scan (gesetzt) → Regel inaktiv; nur der Library-weite Scan urteilt. */
  scopeFolderId: string | null
  /** Dieselbe Schaltung wie `bericht_veraltet`: aus, wenn die Library Frische nicht prueft. */
  berichtFreshness: boolean
}

/** Juengster `BERICHT.md`-Zeitstempel ueber alle gescannten Ordner; null = keine Berichte. */
export function juengsterBericht(folders: readonly ArchiveFolderNode[]): string | null {
  let wert: string | null = null
  for (const folder of folders) {
    if (folder.bericht) wert = newest(wert, folder.bericht.modifiedAt)
  }
  return wert
}

/**
 * `sicht_veraltet` je vorhandener Sicht in `Organisation/`, deren Zeitstempel
 * vor dem juengsten Bericht liegt oder unbekannt ist.
 */
export function checkSichtVeraltet(args: SichtRegelArgs): CoverageGap[] {
  const { folders, scopeFolderId, berichtFreshness } = args
  if (!berichtFreshness || scopeFolderId !== null) return []
  const organisation = folders.find((f) => f.depth === 1 && f.name === SICHTEN_ORDNER)
  if (!organisation) return []
  const bericht = juengsterBericht(folders)
  if (bericht === null) return []

  const gaps: CoverageGap[] = []
  for (const datei of organisation.files) {
    if (!SICHT_DATEINAMEN.includes(datei.name)) continue
    const veraltet = datei.modifiedAt === null || datei.modifiedAt < bericht
    if (!veraltet) continue
    gaps.push(
      createGap({
        scope: 'folder',
        folderId: organisation.folderId,
        path: datei.path,
        type: 'sicht_veraltet',
        targetId: datei.fileId,
        targetName: datei.name,
        message:
          datei.modifiedAt === null
            ? `${datei.name} hat keinen Zeitstempel — ob die Sicht aktuell ist, laesst sich nicht sagen`
            : `${datei.name} ist aelter als der juengste Bericht der Library`,
        detail:
          datei.modifiedAt === null
            ? `juengster Bericht ${bericht}`
            : `Sicht ${datei.modifiedAt}, juengster Bericht ${bericht}`,
      }),
    )
  }
  return gaps
}
