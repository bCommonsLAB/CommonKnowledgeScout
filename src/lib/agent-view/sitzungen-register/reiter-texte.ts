/**
 * @fileoverview Texte des Reiters „Sitzungen": Namen, Daten, „warum" (Register, Welle R3). Reine Funktionen.
 *
 * @description
 * Alles, was der Reiter in Worte fasst, steht hier statt in den Komponenten:
 * Namen der Werkzeuge und Herkuenfte (als `Record`, damit ein neuer Wert den
 * Typcheck bricht), Datumsangaben und der Kasten „warum" — er erklaert den
 * gerechneten Stand aus denselben Stempeln wie `rechneStand`, ohne ihn neu zu
 * entscheiden. Dazu das Lesen der Zugbereiche „1-10; 11-25" fuer „In Teile
 * trennen" (die Regeln dahinter prueft der Server).
 *
 * @module agent-view/sitzungen-register
 */

import type { GemeldetVon, KennungArt, SitzungsQuelle, SitzungsSicht, Zugbereich } from './types'

/** Ausfuehrlich (Detail, Gruppen). */
export const QUELLE_NAMEN: Readonly<Record<SitzungsQuelle | 'unbekannt', string>> = {
  code_lokal: 'Code · lokal',
  code_cloud: 'Code · Cloud',
  cowork: 'Cowork',
  chat: 'Chat',
  unbekannt: 'Werkzeug unbekannt',
}

/** Kurz (Zeile). */
export const QUELLE_KURZ: Readonly<Record<SitzungsQuelle | 'unbekannt', string>> = {
  code_lokal: 'Code',
  code_cloud: 'Cloud',
  cowork: 'Cowork',
  chat: 'Chat',
  unbekannt: '?',
}

export const HERKUNFT_TEXT: Readonly<Record<GemeldetVon, string>> = {
  archiv: 'vom Archiv übernommen',
  import: 'aus der Arbeitsliste übernommen',
  skill: 'vom Skill gemeldet',
  inventar: 'aus einer Bestandsliste gemeldet',
}

export const KENNUNG_TEXT: Readonly<Record<KennungArt, string>> = {
  voll: 'voll',
  praefix: 'nur Kürzel',
  keine: 'keine Kennung',
}

const ISO_TAG = /^(\d{4})-(\d{2})-(\d{2})$/

/** `2026-11-05` → `05.11.` im laufenden Jahr, sonst `05.11.25`; ohne Datum `—`. */
export function zeilenDatum(tag: string | null, jahr: number): string {
  const m = tag?.match(ISO_TAG)
  if (!m) return '—'
  return Number(m[1]) === jahr ? `${m[3]}.${m[2]}.` : `${m[3]}.${m[2]}.${m[1].slice(2)}`
}

/** Beginn bis Ende, so knapp wie moeglich: `03.–04.11.2026`, `30.10.–02.11.2026`. */
export function zeitraumText(beginn: string | null, ende: string | null): string {
  const b = beginn?.match(ISO_TAG)
  if (!b) return 'ohne Datum'
  const e = ende?.match(ISO_TAG)
  if (!e || ende === beginn) return `${b[3]}.${b[2]}.${b[1]}`
  if (b[1] !== e[1]) return `${b[3]}.${b[2]}.${b[1]}–${e[3]}.${e[2]}.${e[1]}`
  if (b[2] !== e[2]) return `${b[3]}.${b[2]}.–${e[3]}.${e[2]}.${e[1]}`
  return `${b[3]}.–${e[3]}.${e[2]}.${e[1]}`
}

/** Zeitstempel → `15.11.` (Ortszeit des Browsers). */
export function stempelTag(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export interface Warum {
  ton: 'gut' | 'offen' | 'neutral'
  titel: string
  text: string
}

function juengsteNotiz(z: SitzungsSicht): string | null {
  const zeiten = z.belege.map((b) => b.notizAktualisiert).filter((t): t is string => t !== null).sort()
  return zeiten[zeiten.length - 1] ?? null
}

function vorhabenName(z: SitzungsSicht): string {
  return z.vorhabenPfad?.split('/').pop() ?? 'dem Vorhaben'
}

function stempelSatz(was: string, am: string | null, notiz: string | null, fehlt: string): string {
  if (am === null) return fehlt
  if (notiz !== null && am < notiz) return `${was} ist älter als die Notiz (${stempelTag(am)}, Notiz ${stempelTag(notiz)}).`
  return `${was} nennt die Sitzung (${stempelTag(am)}).`
}

/** Erklaert den gerechneten Stand; entscheidet ihn nicht neu. */
export function warum(z: SitzungsSicht): Warum {
  const notiz = juengsteNotiz(z)
  const chronik = stempelSatz('Die Chronik SITZUNGEN.md', z.berichtet.chronikAm, notiz, 'Die Chronik SITZUNGEN.md nennt die Sitzung noch nicht.')
  const block = z.vorhabenFolderId === null ? null
    : stempelSatz(`Der Block im BERICHT.md von ${vorhabenName(z)}`, z.berichtet.blockAm, notiz, `Im BERICHT.md von ${vorhabenName(z)} fehlt der erzeugte Block.`)
  switch (z.stand) {
    case 'uebersprungen':
      return { ton: 'neutral', titel: 'Übersprungen', text: z.entscheidungGrund !== null ? `Grund: ${z.entscheidungGrund}` : 'Kein Grund gespeichert.' }
    case 'berichtet':
      return { ton: 'gut', titel: 'Im Bericht', text: [chronik, block ?? 'Ohne Vorhaben genügt die Chronik.'].join(' ') }
    case 'notiz':
      return {
        ton: 'offen',
        titel: 'Noch nicht im Bericht',
        text: [chronik, block, z.vorhabenBestimmt ? null : 'Wo der Beleg liegt, hat noch kein Sichten-Lauf geprüft.',
          'Nachziehen: sichten_regenerieren (Chronik), sitzungen_block_schreiben (Block).'].filter(Boolean).join(' '),
      }
    case 'beleg':
      return { ton: 'offen', titel: 'Notiz fehlt', text: 'Der Beleg liegt vor, die Transformation chatverlauf-de fehlt noch. Nachziehen: transformation_starten mit der Vorlage chatverlauf-de.' }
    case 'gemeldet':
      return { ton: 'offen', titel: 'Beleg fehlt', text: 'Die Sitzung ist gemeldet, ein Beleg liegt noch nicht vor. Abschluss in der Sitzung selbst mit dem Skill sitzung-abschliessen.' }
  }
}

/** „1-10; 11-25" → Zugbereiche; was nicht passt, ist ein Fehler mit Wortlaut. */
export function leseZugbereiche(text: string): { ok: true; bereiche: Zugbereich[] } | { ok: false; fehler: string } {
  const teile = text.split(/[;,]/).map((t) => t.trim()).filter((t) => t !== '')
  if (teile.length === 0) return { ok: false, fehler: 'Keine Zugbereiche angegeben' }
  const bereiche: Zugbereich[] = []
  for (const teil of teile) {
    const m = teil.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (!m) return { ok: false, fehler: `„${teil}" ist kein Zugbereich (Form: 1-10)` }
    bereiche.push({ von: Number(m[1]), bis: Number(m[2]) })
  }
  return { ok: true, bereiche }
}

/** Deep-Link ins Archiv auf eine Datei (dasselbe Muster wie die Werkbank). */
export function archivDateiHref(libraryId: string, folderId: string, fileId: string): string {
  return `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(folderId)}&openFileId=${encodeURIComponent(fileId)}`
}
