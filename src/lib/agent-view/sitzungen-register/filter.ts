/**
 * @fileoverview Filter, Reihenfolge und Bilanz der Register-Sicht (Register, Welle R1). Reine Funktionen.
 *
 * @description
 * Dieselben Filter fuer `sitzungen_auflisten` und spaeter den Reiter (R3):
 * Stand, Quelle, Vorhaben (Pfad mit Unterordnern oder folderId), Zeitraum
 * ueber `beginn`, und eine Auffaelligkeit fuer die Gegenkontrolle.
 * `gemeldet_ohne_beleg` braucht `seitTagen` — ohne Angabe ist das ein Fehler,
 * keine erfundene Vorgabe. Zeilen ohne `beginn` fallen aus einem
 * Zeitraum-Filter heraus; ohne Zeitraum stehen sie am Ende.
 *
 * @module agent-view/sitzungen-register
 */

import {
  AUFFAELLIGKEITEN, SITZUNGS_QUELLEN, STAENDE,
  type Auffaelligkeit, type HinweisCode, type SitzungsQuelle, type SitzungsSicht, type SitzungsStand,
} from './types'

export interface SitzungsFilter {
  stand?: readonly SitzungsStand[]
  quelle?: readonly SitzungsQuelle[]
  /** Library-relativer Pfad (inkl. Unterordner) oder folderId des Vorhabens. */
  vorhaben?: string
  /** `JJJJ-MM-TT`, einschliesslich. */
  von?: string
  bis?: string
  auffaellig?: Auffaelligkeit
  /** Pflicht bei `auffaellig: gemeldet_ohne_beleg`. */
  seitTagen?: number
}

const AUFFAELLIG_HINWEIS: Readonly<Record<Exclude<Auffaelligkeit, 'gemeldet_ohne_beleg'>, HinweisCode>> = {
  notiz_ohne_beleg: 'notiz_kopie_ohne_beleg',
  beleg_ohne_vorhaben: 'beleg_ohne_vorhaben',
  doppelt: 'doppelt',
}

const TAG_MS = 24 * 60 * 60 * 1000

function vorhabenPasst(z: SitzungsSicht, vorhaben: string): boolean {
  if (z.vorhabenFolderId === vorhaben) return true
  const pfad = z.vorhabenPfad
  return pfad !== null && (pfad === vorhaben || pfad.startsWith(`${vorhaben}/`))
}

function auffaellig(z: SitzungsSicht, a: Auffaelligkeit, seitTagen: number | undefined, jetzt: Date): boolean {
  if (a === 'gemeldet_ohne_beleg') {
    if (seitTagen === undefined) throw new Error('auffaellig gemeldet_ohne_beleg braucht seitTagen')
    return z.stand === 'gemeldet' && jetzt.getTime() - Date.parse(z.gemeldetAm) >= seitTagen * TAG_MS
  }
  const code = AUFFAELLIG_HINWEIS[a]
  return z.hinweise.some((h) => h.code === code)
}

export function filtereSitzungen(
  zeilen: readonly SitzungsSicht[],
  f: SitzungsFilter,
  jetzt: Date,
): SitzungsSicht[] {
  return zeilen.filter((z) => {
    if (f.stand && f.stand.length > 0 && !f.stand.includes(z.stand)) return false
    if (f.quelle && f.quelle.length > 0 && (z.quelle === null || !f.quelle.includes(z.quelle))) return false
    if (f.vorhaben !== undefined && !vorhabenPasst(z, f.vorhaben)) return false
    if (f.von !== undefined && (z.beginn === null || z.beginn < f.von)) return false
    if (f.bis !== undefined && (z.beginn === null || z.beginn > f.bis)) return false
    if (f.auffaellig !== undefined && !auffaellig(z, f.auffaellig, f.seitTagen, jetzt)) return false
    return true
  })
}

/** Juengste zuerst; ohne `beginn` am Ende, dort nach registerId. */
export function sortiereSitzungen(zeilen: readonly SitzungsSicht[]): SitzungsSicht[] {
  return [...zeilen].sort((a, b) => {
    if (a.beginn !== b.beginn) {
      if (a.beginn === null) return 1
      if (b.beginn === null) return -1
      return b.beginn.localeCompare(a.beginn)
    }
    return a.registerId.localeCompare(b.registerId)
  })
}

export interface SitzungsBilanz {
  gesamt: number
  jeStand: Record<SitzungsStand, number>
  jeQuelle: Record<SitzungsQuelle | 'unbekannt', number>
  /** Zeilen mit dem Hinweis der jeweiligen Auffaelligkeit (ohne `gemeldet_ohne_beleg`, das braucht seitTagen). */
  auffaellig: Record<Exclude<Auffaelligkeit, 'gemeldet_ohne_beleg'>, number>
  nichtGespeichert: number
  ohneVorhabenBestimmt: number
}

export function bilanz(zeilen: readonly SitzungsSicht[]): SitzungsBilanz {
  const jeStand = Object.fromEntries(STAENDE.map((s) => [s, 0])) as Record<SitzungsStand, number>
  const jeQuelle = Object.fromEntries([...SITZUNGS_QUELLEN, 'unbekannt'].map((q) => [q, 0])) as Record<SitzungsQuelle | 'unbekannt', number>
  const schluessel = AUFFAELLIGKEITEN.filter((a): a is Exclude<Auffaelligkeit, 'gemeldet_ohne_beleg'> => a !== 'gemeldet_ohne_beleg')
  const auf = Object.fromEntries(schluessel.map((a) => [a, 0])) as SitzungsBilanz['auffaellig']
  for (const z of zeilen) {
    jeStand[z.stand] += 1
    jeQuelle[z.quelle ?? 'unbekannt'] += 1
    for (const a of schluessel) if (z.hinweise.some((h) => h.code === AUFFAELLIG_HINWEIS[a])) auf[a] += 1
  }
  return {
    gesamt: zeilen.length,
    jeStand,
    jeQuelle,
    auffaellig: auf,
    nichtGespeichert: zeilen.filter((z) => !z.gespeichert).length,
    ohneVorhabenBestimmt: zeilen.filter((z) => !z.vorhabenBestimmt).length,
  }
}
