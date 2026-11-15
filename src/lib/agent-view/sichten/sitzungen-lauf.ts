/**
 * @fileoverview Sicht `sitzungen` im Berichte-Lauf: laden, rendern, zaehlen (S1, R1).
 *
 * @description
 * Aus `regenerate-sichten.ts` ausgelagert (200-Zeilen-Regel), seit der Lauf
 * nach dem Schreiben von `SITZUNGEN.md` auch das Sitzungs-Register abgleicht
 * (Plan sitzungen-register, R1: fehlende Zeilen anlegen, Ablage-Cache,
 * Stempel `berichtet.chronikAm`). Im Vorschau-Modus wird nichts abgeglichen.
 *
 * @module agent-view/sichten
 */

import type { ArchiveFolderNode } from '../archive-types'
import { registerNachLauf, type RegisterLaufErgebnis } from '@/lib/agent-view/sitzungen-register/register-dienst'
import type { StorageProvider } from '@/lib/storage/types'
import type { BelegKoepfeStatistik } from './sitzungen-beleg-kopf'
import { ladeSitzungen, type GeladeneSitzungen } from './sitzungen-laden'
import { renderSitzungen } from './sitzungen-render'

export interface SitzungenErgebnis {
  sitzungen: number
  vorhaben: number
  ohneVorhaben: number
  /** Querverweise aus `vorhaben:` der Belege (S1b). */
  querverweise: number
  uebersprungen: Array<{ beleg: string; grund: string }>
  hinweise: string[]
  /** Beleg-Koepfe: frisch gelesen vs. aus dem Merker am Twin. */
  belegKoepfe: BelegKoepfeStatistik
  /** R1: Abgleich des Sitzungs-Registers nach dem Schreiben; fehlt bei nurVorschau. */
  register?: RegisterLaufErgebnis
}

export async function sitzungenSicht(args: {
  libraryId: string
  provider: StorageProvider
  folders: readonly ArchiveFolderNode[]
  vorhabenMuster: RegExp | null
  now: Date
}): Promise<{ inhalt: string; ergebnis: SitzungenErgebnis; geladen: GeladeneSitzungen }> {
  const geladen = await ladeSitzungen({
    libraryId: args.libraryId, provider: args.provider, folders: args.folders, vorhabenMuster: args.vorhabenMuster, nurGescannte: false,
  })
  const { zuordnung, belegKoepfe } = geladen
  const vorhabenIds = new Set<string>()
  for (const s of zuordnung.sitzungen) {
    if (s.vorhabenFolderId !== null) vorhabenIds.add(s.vorhabenFolderId)
    for (const v of s.weitereVorhaben) vorhabenIds.add(v.folderId)
  }
  return {
    inhalt: renderSitzungen(zuordnung.sitzungen, args.now),
    geladen,
    ergebnis: {
      sitzungen: zuordnung.sitzungen.length,
      vorhaben: vorhabenIds.size,
      ohneVorhaben: zuordnung.sitzungen.filter((s) => s.vorhabenPfad === null).length,
      querverweise: zuordnung.sitzungen.reduce((n, s) => n + s.weitereVorhaben.length, 0),
      uebersprungen: zuordnung.uebersprungen,
      hinweise: zuordnung.hinweise,
      belegKoepfe,
    },
  }
}

/** Nach dem Schreiben von SITZUNGEN.md: jede Sitzung der Chronik gilt als berichtet (Chronik-Stempel). */
export function registerNachChronik(libraryId: string, geladen: GeladeneSitzungen, now: Date): Promise<RegisterLaufErgebnis> {
  return registerNachLauf({
    libraryId,
    zeilen: geladen.zeilen,
    sitzungen: geladen.zuordnung.sitzungen,
    berichtet: new Set(geladen.zuordnung.sitzungen.map((s) => s.sourceId)),
    art: 'chronik',
    jetzt: now.toISOString(),
  })
}
