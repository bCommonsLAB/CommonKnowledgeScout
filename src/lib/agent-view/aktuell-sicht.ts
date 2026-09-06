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

import type {
  AktuellSicht,
  AktuellSichtOptionen,
  AktuellVorhaben,
} from './aktuell-typen'
import {
  istPostfachImRueckstand,
  lesePostfachStand,
  verdichtePostfach,
} from './postfach-frische'
import { istUeberfaellig } from './sichten/types'
import type { VorhabenCard } from './types'
import { karteOhneAktuellFelder } from './vorhaben-board'

export type {
  AktuellRuhend,
  AktuellSicht,
  AktuellSichtOptionen,
  AktuellVorhaben,
} from './aktuell-typen'
export type { PostfachUebersicht } from './postfach-frische'

/** Anzeigename: Bericht-H1, sonst Ordnername. */
function titelVon(card: VorhabenCard): string {
  const h1 = typeof card.berichtTitel === 'string' ? card.berichtTitel.trim() : ''
  return h1 === '' ? card.name : h1
}

function zuVorhaben(card: VorhabenCard, heute: string, jetzt: Date): AktuellVorhaben {
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
    postfach: lesePostfachStand(card.postfachBis, jetzt),
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
 * @param optionen Gegenwart und Postfach-Schwelle (siehe
 *                 {@link AktuellSichtOptionen}).
 */
export function baueAktuellSicht(
  vorhaben: readonly VorhabenCard[],
  heute: string,
  optionen: AktuellSichtOptionen = {},
): AktuellSicht {
  const jetzt = optionen.jetzt ?? new Date(heute)
  const schwelle = optionen.postfachMaxRueckstandWochen ?? null
  const mitBericht = vorhaben.filter((card) => card.hasBericht)
  // Der erklaerte Status ist das Sortierkriterium — `AKTUELL.md` teilt genauso
  // ein: `aktiv` / ein anderer Wert / gar kein Wert. Kein `default`-Zweig, in
  // dem ein neuer Status still verschwaende (`no-silent-fallbacks`).
  const aktiv = mitBericht
    .filter((card) => card.berichtStatus === 'aktiv')
    .map((card) => zuVorhaben(card, heute, jetzt))
    .sort((a, b) => aktivSchluessel(a).localeCompare(aktivSchluessel(b)))

  return {
    termine: aktiv.filter((v) => v.naechsterTermin !== null),
    aktiv,
    schritteMitTermin: aktiv.filter((v) => v.offenePunkte.length > 0 && v.naechsterTermin !== null),
    schritteOhneTermin: aktiv.filter((v) => v.offenePunkte.length > 0 && v.naechsterTermin === null),
    postfachUebersicht: verdichtePostfach(aktiv.map((v) => v.postfach)),
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
    // Unlesbar zaehlt mit: „Feld da, aber unbrauchbar" ist ein Zustand, den
    // jemand beheben muss — er darf nicht zwischen den Faellen verschwinden.
    postfachRueckstaendig:
      schwelle === null
        ? []
        : aktiv.filter(
            (v) => v.postfach.art === 'unlesbar' || istPostfachImRueckstand(v.postfach, schwelle),
          ),
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
