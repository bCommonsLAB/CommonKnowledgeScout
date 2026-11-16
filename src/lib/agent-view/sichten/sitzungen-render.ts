/**
 * @fileoverview SITZUNGEN.md und Bericht-Block „Sitzungen" rendern (S1/S1b).
 *
 * @description
 * Dieselbe Zeile an beiden Orten: `- JJJJ-MM-TT · Code · [[Beleg]] — Teaser`;
 * ein Querverweis aus einem Nebenvorhaben traegt den Zusatz
 * `*(Beleg liegt in <Ordner>)*`. Die Chronik gruppiert je Vorhaben in
 * Archiv-Ordnung (Owner-Entscheid E1, 08.11.2026), zuletzt „Ohne Vorhaben";
 * der Block traegt nur die Eintraege eines Vorhabens und steht zwischen den
 * Markern aus `sitzungen-block.ts`. Reine Funktionen.
 *
 * @module agent-view/sichten
 */

import { sichtFrontmatter } from './aktuell-render'
import { datumKurz } from './types'
import { gruppiereNachVorhaben, sortiereEintraege, type SitzungsEintrag } from './sitzungen-gruppen'
import type { SitzungsDatensatz } from './sitzungen-types'

export const SITZUNGEN_BLOCK_START = '<!-- sitzungen:start -->'
export const SITZUNGEN_BLOCK_END = '<!-- sitzungen:end -->'
/** Ueberschrift des erzeugten Blocks — unterscheidet sich bewusst von „(nachgetragen …)" der Handarbeit. */
export const SITZUNGEN_BLOCK_UEBERSCHRIFT = '### Sitzungen mit Claude (erzeugt)'

/** Eine Zeile je Eintrag; Art-Wort „?" macht einen Beleg ohne Konvention sichtbar statt ihn zu verstecken. */
export function sitzungsZeile(e: SitzungsEintrag): string {
  const s = e.sitzung
  const ende = s.ende !== null ? ` (bis ${s.ende})` : ''
  const teaser = s.teaser !== '' ? ` — ${s.teaser}` : ''
  const anderswo = e.belegAnderswo ? ` *(Beleg liegt in ${s.vorhabenPfad ?? s.belegOrdnerPfad ?? 'unbekanntem Ordner'})*` : ''
  return `- ${s.datum}${ende} · ${s.artWort ?? '?'} · [[${s.belegName}]]${teaser}${anderswo}`
}

/** Titel des Abschnitts ohne Vorhaben — immer der letzte. */
export const OHNE_VORHABEN_TITEL = 'Ohne Vorhaben'
/** Kennzeichen einer Querverweis-Zeile (Beleg liegt in einem anderen Vorhaben), immer am Zeilenende. */
export const QUERVERWEIS_ENDE = / \*\(Beleg liegt in [^\n]*\)\*$/

/** Ein Abschnitt der Chronik als fertige Zeilen; `pfad: null` = „Ohne Vorhaben". */
export interface ChronikGruppe {
  pfad: string | null
  zeilen: string[]
}

/**
 * Chronik aus fertigen Abschnitten — der eine Weg fuer den vollen Lauf und fuer
 * `sitzung_eintragen` (eine Zeile einsetzen), damit beide dieselbe Datei schreiben.
 * Gezaehlt wird an den Zeilen: jede Sitzung steht genau einmal ohne
 * Querverweis-Zusatz (Ablage oder „Ohne Vorhaben"), jeder Querverweis einmal mit.
 */
export function renderChronik(gruppen: readonly ChronikGruppe[], now: Date): string {
  const alle = gruppen.flatMap((g) => g.zeilen)
  const querverweise = alle.filter((zeile) => QUERVERWEIS_ENDE.test(zeile)).length
  const sitzungen = alle.length - querverweise
  const vorhaben = gruppen.filter((g) => g.pfad !== null).length
  const z: string[] = []
  z.push('# SITZUNGEN — Chronik der Arbeitssitzungen mit Claude', '')
  z.push(`Erzeugt am ${datumKurz(now)} aus den Sitzungsnotizen (Vorlage \`chatverlauf-de\`) — **nicht von Hand pflegen.**`)
  z.push('Gepflegt werden die Belege in den Vorhabensordnern; diese Chronik wird daraus')
  z.push('erzeugt (KnowledgeScout, Werkzeug `sichten_regenerieren`).', '')
  z.push(
    `**${sitzungen} Sitzungen in ${vorhaben} Vorhaben**, je Vorhaben chronologisch (älteste zuerst).` +
      (querverweise > 0 ? ` ${querverweise} Zeilen sind Querverweise aus Nebenvorhaben (*Beleg liegt in …*).` : ''),
    '', '---', '',
  )
  if (gruppen.length === 0) z.push('Keine Sitzungsnotizen gefunden.', '')
  for (const g of gruppen) {
    z.push(`## ${g.pfad ?? OHNE_VORHABEN_TITEL} (${g.zeilen.length})`, '')
    z.push(...g.zeilen)
    z.push('')
  }
  const kopf = sichtFrontmatter('sitzungen', now, [
    ['anzahl_sitzungen', sitzungen],
    ['anzahl_vorhaben', vorhaben],
    ['anzahl_querverweise', querverweise],
  ])
  return kopf + z.join('\n')
}

export function renderSitzungen(sitzungen: readonly SitzungsDatensatz[], now: Date): string {
  const gruppen = gruppiereNachVorhaben(sitzungen).map((g) => ({ pfad: g.pfad, zeilen: g.eintraege.map(sitzungsZeile) }))
  return renderChronik(gruppen, now)
}

/** Block aus fertigen, schon sortierten Zeilen — wie `sitzungenBlock`, fuer Einzel-Eintrag und Teilbaum-Lauf. */
export function sitzungenBlockAusZeilen(zeilen: readonly string[], heute: string): string {
  const z = [SITZUNGEN_BLOCK_START, SITZUNGEN_BLOCK_UEBERSCHRIFT, '']
  z.push(`Stand ${heute} — erzeugt von KnowledgeScout (\`sitzungen_block_schreiben\`), nicht von Hand pflegen.`, '')
  z.push(...zeilen)
  z.push(SITZUNGEN_BLOCK_END)
  return z.join('\n')
}

/** Block fuer EIN Vorhaben, Marker inklusive (so wie `erschliessungsBloecke` ihn liefert). */
export function sitzungenBlock(eintraege: readonly SitzungsEintrag[], heute: string): string {
  return sitzungenBlockAusZeilen(sortiereEintraege(eintraege).map(sitzungsZeile), heute)
}
