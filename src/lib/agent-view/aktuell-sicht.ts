/**
 * @fileoverview Aktuell-Sicht (Welle A7): „woran arbeite ich gerade?" — pur.
 *
 * @description
 * Der Einstieg in die Agentensicht beantwortet dieselbe Frage wie die
 * exportierte `Organisation/AKTUELL.md` — aus DENSELBEN Daten, nicht aus der
 * Datei: die `VorhabenCard`s des gespeicherten Reports tragen seit A7 die
 * Bericht-Felder (`berichtNaechsterTermin`, `berichtOffenePunkte`, …), die
 * `renderAktuell` aus dem Frontmatter zieht. Reihenfolge und Einteilung
 * folgen deshalb Zeile fuer Zeile dem Renderer — die Sicht im Browser und die
 * Datei fuer Obsidian/Cowork koennen nicht auseinanderlaufen.
 *
 * EIN Unterschied ist gewollt und benannt: „ueberfaellig" misst gegen HEUTE,
 * nicht gegen den Erzeugungstag. Ein Termin verstreicht auch ohne Scan; die
 * Sicht darf ihn deshalb nicht als offen zeigen, nur weil niemand neu
 * gescannt hat.
 *
 * Reine Funktion, kein I/O — testbar ohne Storage und ohne React.
 *
 * @module agent-view
 */

import { istUeberfaellig } from './sichten/types'
import type { VorhabenCard } from './types'
import { karteOhneAktuellFelder } from './vorhaben-board'

/** Ein Vorhaben in der Tages-Uebersicht (Termin-Leiste und Tabelle teilen sich das). */
export interface AktuellVorhaben {
  folderId: string
  /** Bericht-H1, sonst Ordnername — nie leer (der Mensch erkennt das Vorhaben daran). */
  titel: string
  name: string
  path: string
  rolle: string | null
  letzteAktivitaet: string | null
  naechsterTermin: string | null
  /** `termin_fixiert: nein` — der Termin ist noch nicht vereinbart. */
  terminFixiert: boolean
  /** Termin liegt vor heute — der Bericht ist nachzuziehen, nicht die Sicht. */
  ueberfaellig: boolean
  /** Storage-Id des `BERICHT.md` (Deep-Link ins Archiv); null = kein Bericht. */
  berichtFileId: string | null
  /** Die ersten offenen Punkte (wie `AKTUELL.md`). */
  offenePunkte: string[]
  /** Offene Punkte ueber die gezeigten hinaus — die Kappung bleibt sichtbar. */
  weiterePunkte: number
  /** Offene Befunde, die auf den Menschen warten (Bruecke zur Werkbank). */
  wartetAufDich: number
}

/** Ein ruhendes oder abgeschlossenes Vorhaben — eine Zeile, kein Detail. */
export interface AktuellRuhend {
  folderId: string
  titel: string
  /** Roher `status`-Wert aus dem Bericht (bleibt sichtbar, kein stilles Mapping). */
  status: string
  letzteAktivitaet: string | null
}

export interface AktuellSicht {
  /** Aktive Vorhaben MIT Termin, nach Termin sortiert. */
  termine: AktuellVorhaben[]
  /** Alle aktiven Vorhaben (Termin zuerst, dann letzte Aktivitaet). */
  aktiv: AktuellVorhaben[]
  /** Aktive Vorhaben mit mindestens einem offenen Punkt. */
  mitSchritten: AktuellVorhaben[]
  ruhend: AktuellRuhend[]
  /** Vorhaben mit Bericht, aber ohne `status:` — die Sicht kann sie nicht einordnen. */
  ohneStatus: Array<{ folderId: string; titel: string; path: string }>
  /** Vorhaben ganz ohne `BERICHT.md` — die Abdeckungsluecke dieser Sicht. */
  ohneBericht: number
  /** Vorhaben mit Bericht (der Nenner der Abdeckungszeile). */
  mitBericht: number
  /** Karten aus einem Scan vor A7 — die Felder fehlen, das wird gesagt. */
  altKarten: number
}

/** Anzeigename: Bericht-H1, sonst Ordnername. */
function titelVon(card: VorhabenCard): string {
  const h1 = typeof card.berichtTitel === 'string' ? card.berichtTitel.trim() : ''
  return h1 === '' ? card.name : h1
}

function zuVorhaben(card: VorhabenCard, heute: string): AktuellVorhaben {
  const punkte = card.berichtOffenePunkte ?? []
  const gesamt = card.berichtOffeneAnzahl ?? punkte.length
  const termin = card.berichtNaechsterTermin ?? null
  return {
    folderId: card.folderId,
    titel: titelVon(card),
    name: card.name,
    path: card.path,
    rolle: card.berichtRolle ?? null,
    letzteAktivitaet: card.berichtLetzteAktivitaet ?? null,
    naechsterTermin: termin,
    terminFixiert: card.berichtTerminFixiert !== false,
    ueberfaellig: istUeberfaellig(termin, heute),
    berichtFileId: card.berichtFileId ?? null,
    offenePunkte: punkte,
    weiterePunkte: Math.max(0, gesamt - punkte.length),
    wartetAufDich: card.gapsByActor.mensch,
  }
}

/**
 * Sortierschluessel der aktiven Vorhaben — Zeichen fuer Zeichen wie
 * `renderAktuell`: naechster Termin zuerst, Vorhaben ohne Termin ans Ende
 * (`9999`), gleichauf entscheidet die letzte Aktivitaet.
 */
function aktivSchluessel(v: AktuellVorhaben): string {
  return `${v.naechsterTermin ?? '9999'}|${v.letzteAktivitaet ?? ''}`
}

/**
 * Baut die Tages-Uebersicht aus den Vorhaben-Karten des Reports.
 *
 * @param vorhaben Karten des gespeicherten Reports (`report.vorhaben`).
 * @param heute Tagesdatum `JJJJ-MM-TT` — der Aufrufer reicht es herein,
 *              damit die Funktion rein bleibt (`isoHeute(new Date())`).
 */
export function baueAktuellSicht(
  vorhaben: readonly VorhabenCard[],
  heute: string,
): AktuellSicht {
  const mitBericht = vorhaben.filter((card) => card.hasBericht)
  // Der erklaerte Status ist das Sortierkriterium — `AKTUELL.md` teilt genauso
  // ein: `aktiv` / ein anderer Wert / gar kein Wert. Kein `default`-Zweig, in
  // dem ein neuer Status still verschwaende (`no-silent-fallbacks`).
  const aktiv = mitBericht
    .filter((card) => card.berichtStatus === 'aktiv')
    .map((card) => zuVorhaben(card, heute))
    .sort((a, b) => aktivSchluessel(a).localeCompare(aktivSchluessel(b)))

  return {
    termine: aktiv.filter((v) => v.naechsterTermin !== null),
    aktiv,
    mitSchritten: aktiv.filter((v) => v.offenePunkte.length > 0),
    ruhend: mitBericht
      .filter((card) => typeof card.berichtStatus === 'string' && card.berichtStatus !== 'aktiv')
      .map((card) => ({
        folderId: card.folderId,
        titel: titelVon(card),
        status: card.berichtStatus ?? '',
        letzteAktivitaet: card.berichtLetzteAktivitaet ?? null,
      })),
    ohneStatus: mitBericht
      .filter((card) => card.berichtStatus === null || card.berichtStatus === undefined)
      .map((card) => ({ folderId: card.folderId, titel: titelVon(card), path: card.path })),
    ohneBericht: vorhaben.length - mitBericht.length,
    mitBericht: mitBericht.length,
    altKarten: vorhaben.filter(karteOhneAktuellFelder).length,
  }
}

/** Ist in der Sicht ueberhaupt etwas zu sehen? (Leerzustand der Seite.) */
export function sichtIstLeer(sicht: AktuellSicht): boolean {
  return (
    sicht.aktiv.length === 0 &&
    sicht.ruhend.length === 0 &&
    sicht.ohneStatus.length === 0
  )
}
