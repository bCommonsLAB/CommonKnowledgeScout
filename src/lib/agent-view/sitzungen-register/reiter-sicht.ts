/**
 * @fileoverview Filter, Sichten und Reihenfolge des Reiters „Sitzungen" (Register, Welle R3). Reine Funktionen.
 *
 * @description
 * Der Reiter bekommt ALLE Zeilen und rechnet hier, was er zeigt:
 * - Sicht `offen` = weder `berichtet` noch `uebersprungen`; `auffaellig` = mit
 *   mindestens einem Grund (jeder Hinweis-Code der Zeile oder „gemeldet ohne
 *   Beleg" seit {@link GEMELDET_FRIST_TAGE} Tagen — dieselbe Regel wie
 *   `sitzungen_auflisten`); `alle`.
 * - Werkzeug-Chips: `code` = lokal und Cloud; keiner gewaehlt = alle. Mit
 *   gewaehltem Chip fallen Zeilen ohne Werkzeug heraus (wie im Bruecken-Filter).
 * - Zeitraum ueber `beginn`; Zeilen ohne `beginn` fallen dann heraus.
 * - Suche in Titel, Kennung/Schluessel und Branch.
 * Jeder Hinweis-Code hat einen Namen (`Record` statt Liste): ein neuer Code
 * bricht den Typcheck, statt still in keiner Gruppe zu landen.
 *
 * @module agent-view/sitzungen-register
 */

import { filtereSitzungen, sortiereSitzungen } from './filter'
import type { HinweisCode, SitzungsQuelle, SitzungsSicht } from './types'

export const REITER_SICHTEN = ['offen', 'auffaellig', 'alle'] as const
export type ReiterSicht = (typeof REITER_SICHTEN)[number]

export const REITER_WERKZEUGE = ['code', 'cowork', 'chat'] as const
export type ReiterWerkzeug = (typeof REITER_WERKZEUGE)[number]

export const WERKZEUG_QUELLEN: Readonly<Record<ReiterWerkzeug, readonly SitzungsQuelle[]>> = {
  code: ['code_lokal', 'code_cloud'],
  cowork: ['cowork'],
  chat: ['chat'],
}

export const REITER_SORTIERUNGEN = ['neueste', 'aelteste', 'titel'] as const
export type ReiterSortierung = (typeof REITER_SORTIERUNGEN)[number]

/** Ab wann eine gemeldete Zeile ohne Beleg auffaellt (Figma „Gemeldet, Beleg fehlt (über 7 Tage)"). */
export const GEMELDET_FRIST_TAGE = 7

export type AuffaelligGrund = HinweisCode | 'gemeldet_ohne_beleg'

/** Name je Grund; die Reihenfolge der Schluessel ist die Reihenfolge der Gruppen. */
export const AUFFAELLIG_NAMEN: Readonly<Record<AuffaelligGrund, string>> = {
  beleg_ohne_vorhaben: 'Beleg ohne Vorhaben',
  doppelt: 'Doppelt',
  beleg_fehlt: 'Beleg fehlt im Speicher',
  kennung_abweichend: 'Kennung weicht ab',
  gemeldet_ohne_beleg: `Gemeldet, Beleg fehlt (über ${GEMELDET_FRIST_TAGE} Tage)`,
  quelle_unbekannt: 'Werkzeug unbekannt',
  notiz_kopie_ohne_beleg: 'Notiz-Kopie ohne Beleg',
  uebersprungen_mit_beleg: 'Übersprungen, aber Beleg da',
  praefix_mehrdeutig: 'Kürzel mehrdeutig',
  notiz_ohne_zeitstempel: 'Notiz ohne Zeitstempel',
}

export const AUFFAELLIG_GRUENDE = Object.keys(AUFFAELLIG_NAMEN) as AuffaelligGrund[]

export interface ReiterFilter {
  suche: string
  werkzeuge: readonly ReiterWerkzeug[]
  von: string | null
  bis: string | null
}

export function istOffen(z: Pick<SitzungsSicht, 'stand'>): boolean {
  return z.stand !== 'berichtet' && z.stand !== 'uebersprungen'
}

/** Gruende, aus denen eine Zeile auffaellt, in Gruppen-Reihenfolge. */
export function auffaelligGruende(z: SitzungsSicht, jetzt: Date): AuffaelligGrund[] {
  const gruende = new Set<AuffaelligGrund>(z.hinweise.map((h) => h.code))
  const alt = filtereSitzungen([z], { auffaellig: 'gemeldet_ohne_beleg', seitTagen: GEMELDET_FRIST_TAGE }, jetzt)
  if (alt.length > 0) gruende.add('gemeldet_ohne_beleg')
  return AUFFAELLIG_GRUENDE.filter((g) => gruende.has(g))
}

export function inSicht(z: SitzungsSicht, sicht: ReiterSicht, jetzt: Date): boolean {
  switch (sicht) {
    case 'offen':
      return istOffen(z)
    case 'auffaellig':
      return auffaelligGruende(z, jetzt).length > 0
    case 'alle':
      return true
  }
}

export function zaehleSichten(zeilen: readonly SitzungsSicht[], jetzt: Date): Record<ReiterSicht, number> {
  return {
    offen: zeilen.filter((z) => inSicht(z, 'offen', jetzt)).length,
    auffaellig: zeilen.filter((z) => inSicht(z, 'auffaellig', jetzt)).length,
    alle: zeilen.length,
  }
}

export function suchePasst(z: Pick<SitzungsSicht, 'titel' | 'sitzungId' | 'registerId' | 'branch'>, suche: string): boolean {
  const q = suche.trim().toLocaleLowerCase('de')
  if (q === '') return true
  return [z.titel, z.sitzungId, z.registerId, z.branch].some((t) => t !== null && t.toLocaleLowerCase('de').includes(q))
}

/** Chips, Zeitraum und Suche — vor der Sicht, damit die Zahlen im Umschalter zur Liste passen. */
export function filtereReiter(zeilen: readonly SitzungsSicht[], f: ReiterFilter, jetzt: Date): SitzungsSicht[] {
  const quelle = f.werkzeuge.flatMap((w) => WERKZEUG_QUELLEN[w])
  const basis = filtereSitzungen(zeilen, {
    quelle,
    ...(f.von !== null ? { von: f.von } : {}),
    ...(f.bis !== null ? { bis: f.bis } : {}),
  }, jetzt)
  return basis.filter((z) => suchePasst(z, f.suche))
}

/** Neueste/aelteste nach `beginn` (ohne Datum immer am Ende), oder Titel. */
export function sortiereReiter(zeilen: readonly SitzungsSicht[], sortierung: ReiterSortierung): SitzungsSicht[] {
  switch (sortierung) {
    case 'neueste':
      return sortiereSitzungen(zeilen)
    case 'aelteste': {
      const mitDatum = sortiereSitzungen(zeilen.filter((z) => z.beginn !== null)).reverse()
      return [...mitDatum, ...sortiereSitzungen(zeilen.filter((z) => z.beginn === null))]
    }
    case 'titel':
      return [...zeilen].sort((a, b) => a.titel.localeCompare(b.titel, 'de') || a.registerId.localeCompare(b.registerId))
  }
}
