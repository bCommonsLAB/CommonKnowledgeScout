/**
 * @fileoverview Gerechneter Stand einer Register-Zeile (Register, Welle R1). Reine Funktionen.
 *
 * @description
 * Rangfolge `uebersprungen` > `berichtet` > `notiz` > `beleg` > `gemeldet`.
 * `berichtet` (W4) heisst: Notiz da, die Chronik (`chronikAm`) ist juenger als
 * die juengste Notiz, und liegt der Beleg in einem Vorhaben, auch der Block im
 * BERICHT.md (`blockAm`). Widersprueche werden Hinweise an der Zeile:
 * uebersprungen mit Beleg; zwei Belege ohne oder mit ueberlappenden Zuegen
 * (`doppelt` — Teil-Belege mit getrennten Zuegen sind in Ordnung);
 * Notiz-Kopie ohne Beleg; Beleg im Speicher nicht gefunden; Beleg ohne Vorhaben.
 *
 * @module agent-view/sitzungen-register
 */

import { zuegeText } from './ist-beleg'
import type { ZugeordneteZeile } from './ist-zuordnen'
import type { IstBeleg, SitzungsHinweis, SitzungsSicht, SitzungsStand } from './types'

/** Zwei oder mehr Belege, deren Zuege fehlen oder sich ueberschneiden. */
export function belegeDoppelt(belege: readonly IstBeleg[]): boolean {
  if (belege.length < 2) return false
  const bereiche = belege.map((b) => b.zuege)
  if (bereiche.some((z) => z === null)) return true
  const sortiert = bereiche.filter((z): z is NonNullable<typeof z> => z !== null).sort((a, b) => a.von - b.von)
  return sortiert.some((z, i) => i > 0 && z.von <= sortiert[i - 1].bis)
}

function juengsteNotiz(belege: readonly IstBeleg[]): { zeit: string | null; ohneZeit: boolean } {
  const notizen = belege.filter((b) => b.hatNotiz)
  const zeiten = notizen.map((b) => b.notizAktualisiert).filter((z): z is string => z !== null).sort()
  return { zeit: zeiten[zeiten.length - 1] ?? null, ohneZeit: notizen.some((b) => b.notizAktualisiert === null) }
}

/**
 * Stand und Hinweise. `fehlend`: sourceId → Fehlertext fuer Belege aus
 * `belegSourceIds`, die der Speicher nicht (mehr) liefert.
 */
export function rechneStand(
  zeile: ZugeordneteZeile,
  fehlend: ReadonlyMap<string, string>,
): { stand: SitzungsStand; hinweise: SitzungsHinweis[]; imBericht: boolean } {
  const { doc, belege } = zeile
  const hinweise: SitzungsHinweis[] = [...zeile.hinweise]
  const belegDa = belege.length > 0
  const hatNotiz = belege.some((b) => b.hatNotiz)
  const notiz = juengsteNotiz(belege)

  for (const sourceId of doc.belegSourceIds) {
    const fehler = fehlend.get(sourceId)
    if (fehler !== undefined) hinweise.push({ code: 'beleg_fehlt', text: `Beleg ${sourceId} nicht im Speicher: ${fehler}` })
  }
  if (doc.entscheidung === 'ueberspringen' && belegDa) {
    hinweise.push({ code: 'uebersprungen_mit_beleg', text: `als uebersprungen markiert, aber ${belege.length} Beleg(e) vorhanden` })
  }
  if (belegeDoppelt(belege)) {
    hinweise.push({ code: 'doppelt', text: `${belege.length} Belege ohne getrennte Zuege: ${belege.map((b) => b.name).join(' | ')}` })
  }
  if (doc.altNotizPfad !== null && !belegDa) {
    hinweise.push({ code: 'notiz_kopie_ohne_beleg', text: `Notiz-Kopie ${doc.altNotizPfad} ohne Beleg` })
  }
  if (belegDa && doc.ablage !== null && doc.ablage.vorhabenPfad === null) {
    hinweise.push({ code: 'beleg_ohne_vorhaben', text: `Beleg liegt ausserhalb eines Vorhabens (${doc.ablage.belegOrdnerPfad ?? 'Ordner unbekannt'})` })
  }
  if (doc.quelle === null) hinweise.push({ code: 'quelle_unbekannt', text: 'Werkzeug aus Beleg und Notiz nicht erkennbar' })
  if (notiz.ohneZeit) hinweise.push({ code: 'notiz_ohne_zeitstempel', text: 'Notiz ohne updatedAt — berichtet nicht pruefbar' })

  const imVorhaben = doc.ablage !== null && doc.ablage.vorhabenFolderId !== null
  const { chronikAm, blockAm } = doc.berichtet
  const berichtet =
    hatNotiz && !notiz.ohneZeit && notiz.zeit !== null &&
    chronikAm !== null && chronikAm >= notiz.zeit &&
    (!imVorhaben || (blockAm !== null && blockAm >= notiz.zeit))

  const stand: SitzungsStand =
    doc.entscheidung === 'ueberspringen' ? 'uebersprungen'
      : berichtet ? 'berichtet'
        : hatNotiz ? 'notiz'
          : belegDa ? 'beleg'
            : 'gemeldet'
  return { stand, hinweise, imBericht: berichtet }
}

/** Die Zeile, wie Werkzeug und Reiter sie zeigen. */
export function zuSicht(zeile: ZugeordneteZeile, fehlend: ReadonlyMap<string, string>): SitzungsSicht {
  const { doc, belege } = zeile
  const { stand, hinweise, imBericht } = rechneStand(zeile, fehlend)
  return {
    registerId: doc.registerId,
    sitzungId: doc.sitzungId ?? null,
    kennung: doc.kennung,
    quelle: doc.quelle,
    titel: doc.titelOriginal ?? belege[0]?.titel ?? doc.registerId,
    beginn: doc.beginn ?? belege[0]?.datum ?? null,
    ende: doc.ende,
    link: doc.link,
    repo: doc.repo,
    branch: doc.branch,
    prs: doc.prs,
    stand,
    hinweise,
    imBericht,
    berichtet: doc.berichtet,
    entscheidung: doc.entscheidung,
    entscheidungGrund: doc.entscheidungGrund,
    zugbereiche: doc.zugbereiche,
    vorhabenVorschlag: doc.vorhabenVorschlag,
    bemerkung: doc.bemerkung,
    vorhabenPfad: doc.ablage?.vorhabenPfad ?? null,
    vorhabenFolderId: doc.ablage?.vorhabenFolderId ?? null,
    vorhabenBestimmt: doc.ablage !== null,
    belege: belege.map((b) => ({
      sourceId: b.sourceId, name: b.name, zuege: zuegeText(b.zuege), notiz: b.hatNotiz, notizAktualisiert: b.notizAktualisiert,
    })),
    gemeldetVon: doc.gemeldetVon,
    gemeldetAm: doc.gemeldetAm,
    gespeichert: zeile.gespeichert,
  }
}
