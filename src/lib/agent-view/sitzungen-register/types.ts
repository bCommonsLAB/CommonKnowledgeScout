/**
 * @fileoverview Datenmodell des Sitzungs-Registers (Plan sitzungen-register, Welle R1).
 *
 * @description
 * Das Register ist das SOLL: welche Arbeitssitzungen mit Claude es gab, auch
 * ohne Beleg. Das IST sind Beleg (Datei beim Vorhaben) und Notiz
 * (Transformation `chatverlauf-de` am Twin). Der Stand einer Zeile wird aus
 * beidem gerechnet (`stand-rechnen.ts`), nie abgehakt. Ein Dokument je
 * Sitzung und Library — bewusst NICHT je User (Owner-Entscheid E1).
 *
 * Schluessel: `registerId` ist immer da. Bei bekannter Kennung ist er gleich
 * der `sitzungId`; Altzeilen ohne Kennung heissen `alt:<Nr>` (R2), Belege ohne
 * Kennung `beleg:<sourceId>`. Mengen als `readonly`-Tupel statt Enums.
 *
 * @module agent-view/sitzungen-register
 */

export const SITZUNGS_QUELLEN = ['code_lokal', 'code_cloud', 'cowork', 'chat'] as const
export type SitzungsQuelle = (typeof SITZUNGS_QUELLEN)[number]

export const KENNUNG_ARTEN = ['voll', 'praefix', 'keine'] as const
export type KennungArt = (typeof KENNUNG_ARTEN)[number]

export const ENTSCHEIDUNGEN = ['offen', 'ueberspringen', 'trennen'] as const
export type Entscheidung = (typeof ENTSCHEIDUNGEN)[number]

export const GEMELDET_VON = ['skill', 'inventar', 'import', 'archiv'] as const
export type GemeldetVon = (typeof GEMELDET_VON)[number]

/** Rangfolge: der erste zutreffende Stand gilt. */
export const STAENDE = ['uebersprungen', 'berichtet', 'notiz', 'beleg', 'gemeldet'] as const
export type SitzungsStand = (typeof STAENDE)[number]

export const AUFFAELLIGKEITEN = ['notiz_ohne_beleg', 'gemeldet_ohne_beleg', 'beleg_ohne_vorhaben', 'doppelt'] as const
export type Auffaelligkeit = (typeof AUFFAELLIGKEITEN)[number]

/** Praefixe fuer Register-Schluessel ohne volle Kennung. */
export const ALT_PRAEFIX = 'alt:'
export const BELEG_PRAEFIX = 'beleg:'

export interface Zugbereich {
  von: number
  bis: number
}

export interface VorhabenVorschlag {
  /** Ordnername des vorgeschlagenen Vorhabens. */
  ordner: string
  /** Wer vorschlaegt (z. B. `skill`, `owner`). */
  herkunft: string
}

/** Cache der Sichten-Laeufe (W7): wo der Beleg liegt, ohne Speicher-Scan lesbar. */
export interface SitzungsAblage {
  vorhabenPfad: string | null
  vorhabenFolderId: string | null
  belegOrdnerPfad: string | null
  geprueftAm: string
}

/**
 * Wann die Sitzung zuletzt berichtet wurde (W4). `chronikAm` setzt
 * `sichten_regenerieren` (SITZUNGEN.md), `blockAm` setzt
 * `sitzungen_block_schreiben` (Block im BERICHT.md des Vorhabens).
 */
export interface SitzungsBerichtet {
  chronikAm: string | null
  blockAm: string | null
}

export interface SitzungsRegisterDoc {
  _id?: string
  libraryId: string
  registerId: string
  /** Volle Kennung; fehlt das Feld, ist sie unbekannt (partieller Unique-Index). */
  sitzungId?: string
  kennung: KennungArt
  /** Nur bei `kennung: praefix` (8-Zeichen-Kuerzel aus dem Export, R2). */
  kennungPraefix?: string
  /** null = aus dem Archiv uebernommen, Werkzeug nicht erkennbar (Hinweis `quelle_unbekannt`). */
  quelle: SitzungsQuelle | null
  titelOriginal: string | null
  beginn: string | null
  ende: string | null
  link: string | null
  repo: string | null
  branch: string | null
  prs: string[]
  /** Nummer der alten Arbeitsliste (z. B. `B45`, R2). */
  nrAlt: string | null
  entscheidung: Entscheidung
  entscheidungGrund: string | null
  zugbereiche: Zugbereich[]
  vorhabenVorschlag: VorhabenVorschlag | null
  bemerkung: string | null
  belegSourceIds: string[]
  altNotizPfad: string | null
  ablage: SitzungsAblage | null
  berichtet: SitzungsBerichtet
  gemeldetVon: GemeldetVon
  gemeldetAm: string
  geaendertAm: string
}

/** Ein Beleg im Ist — aus einer Notiz-Transformation oder (ohne Notiz) aus `belegSourceIds`. */
export interface IstBeleg {
  sourceId: string
  name: string
  parentId: string
  /** `session_id` aus dem gemerkten Beleg-Kopf; null = Kopf nicht gemerkt oder ohne Kennung. */
  kopfKennung: string | null
  /** `sitzung` aus der Notiz; null = keine Notiz oder ohne Feld. */
  notizKennung: string | null
  /** `werkzeug` aus Beleg-Kopf, ersatzweise aus der Notiz. */
  werkzeug: string | null
  repo: string | null
  branch: string | null
  zuege: Zugbereich | null
  titel: string | null
  datum: string | null
  ende: string | null
  hatNotiz: boolean
  /** `updatedAt` der Notiz; null = keine Notiz oder ohne Zeitstempel. */
  notizAktualisiert: string | null
}

export const HINWEIS_CODES = [
  'uebersprungen_mit_beleg',
  'doppelt',
  'notiz_kopie_ohne_beleg',
  'beleg_fehlt',
  'beleg_ohne_vorhaben',
  'kennung_abweichend',
  'praefix_mehrdeutig',
  'quelle_unbekannt',
  'notiz_ohne_zeitstempel',
] as const
export type HinweisCode = (typeof HINWEIS_CODES)[number]

export interface SitzungsHinweis {
  code: HinweisCode
  text: string
}

/** Eine Zeile, wie Werkzeug und Reiter sie zeigen: Soll + Ist + gerechneter Stand. */
export interface SitzungsSicht {
  registerId: string
  sitzungId: string | null
  kennung: KennungArt
  quelle: SitzungsQuelle | null
  titel: string
  beginn: string | null
  ende: string | null
  link: string | null
  repo: string | null
  branch: string | null
  prs: string[]
  stand: SitzungsStand
  hinweise: SitzungsHinweis[]
  /** Notiz in Chronik und (im Vorhaben) Block — dieselbe Regel wie `berichtet`, auch bei `uebersprungen` (R3, Zeichen R). */
  imBericht: boolean
  /** Stempel der Sichten-Laeufe, damit „halb berichtet" (Chronik ja, Block nein) sichtbar ist (R3). */
  berichtet: SitzungsBerichtet
  entscheidung: Entscheidung
  entscheidungGrund: string | null
  zugbereiche: Zugbereich[]
  vorhabenVorschlag: VorhabenVorschlag | null
  bemerkung: string | null
  /** null + `vorhabenBestimmt: false` = noch kein Sichten-Lauf hat die Ablage geprueft. */
  vorhabenPfad: string | null
  vorhabenFolderId: string | null
  vorhabenBestimmt: boolean
  belege: Array<{ sourceId: string; name: string; zuege: string | null; notiz: boolean; notizAktualisiert: string | null }>
  gemeldetVon: GemeldetVon
  gemeldetAm: string
  /** false = Zeile aus dem Archiv, noch nicht im Register gespeichert (W3). */
  gespeichert: boolean
}
