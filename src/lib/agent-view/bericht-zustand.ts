/**
 * @fileoverview Messungen am `BERICHT.md` als ZUSTAND (Wunschliste 6, Teil A) — pur.
 *
 * @description
 * „Der Bericht ist Zustand und wird ueberschrieben; Notizen und
 * Verlaufsdateien sind Verlauf und duerfen wachsen." Diese Datei traegt die
 * reine Logik der drei Messungen — Schwelle je Rolle, Zeilen unter
 * „## Status", offene Punkte mit vergangenem Datum. Die Regeln selbst (mit
 * Ordnerknoten und Befund) liegen in `bericht-zustand-regel.ts`; dieselbe
 * Trennung wie `repo-frische.ts` / `repo-regel.ts`.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { BerichtMaxBytes } from './types'

const TAG_MS = 24 * 60 * 60 * 1000

export interface RollenSchwelle {
  /** Wirksame Schwelle in Bytes; null = fuer diese Rolle ist die Regel aus. */
  schwelle: number | null
  /** Unter welcher Rolle gemessen wurde. */
  gemessenAls: keyof BerichtMaxBytes
  /**
   * Die `rolle` des Berichts fehlt oder ist keine der beiden bekannten — dann
   * wird als Anwendung gemessen, und der Befund SAGT das (kein stiller Default).
   */
  rolleUnbekannt: boolean
}

/** Form der Schwelle in der Library-Config (`agentView.berichtMaxBytes`). */
export interface BerichtMaxBytesConfig {
  anwendung?: number | null
  plattform?: number | null
}

function endlicheZahl(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}

/**
 * Liest die Schwelle aus der Library-Config — EINE Stelle fuer den Scan und
 * fuer den Groessenhinweis der Schreibwerkzeuge (Wunschliste 6, B2), damit
 * beide denselben Massstab anlegen. Fehlt/ungueltig ⇒ null ⇒ Regel aus.
 */
export function leseBerichtMaxBytes(config: BerichtMaxBytesConfig | undefined): BerichtMaxBytes {
  return { anwendung: endlicheZahl(config?.anwendung), plattform: endlicheZahl(config?.plattform) }
}

/** Waehlt die Laengen-Schwelle zur `rolle` des Berichts. */
export function schwelleFuerRolle(rolle: string | null, max: BerichtMaxBytes): RollenSchwelle {
  if (rolle === 'plattform') return { schwelle: max.plattform, gemessenAls: 'plattform', rolleUnbekannt: false }
  return { schwelle: max.anwendung, gemessenAls: 'anwendung', rolleUnbekannt: rolle !== 'anwendung' }
}

/** Zeilen des Abschnitts `## <ueberschrift>` (ohne die Ueberschrift); null = Abschnitt fehlt. */
export function abschnittZeilen(body: string, ueberschrift: string): string[] | null {
  const zeilen = body.split(/\r?\n/)
  const start = zeilen.findIndex((zeile) => zeile.trim() === `## ${ueberschrift}`)
  if (start < 0) return null
  const rest = zeilen.slice(start + 1)
  const ende = rest.findIndex((zeile) => /^#{1,2} /.test(zeile))
  return ende < 0 ? rest : rest.slice(0, ende)
}

/**
 * Zaehlt die Zeilen unter „## Status": nicht-leere Zeilen AUSSERHALB von
 * Codebloecken — der `knowledgescout:`-Block steht per Konvention in einem
 * Codeblock und zaehlt nicht zum Fliesstext. null = kein Status-Abschnitt.
 */
export function statusZeilen(body: string): number | null {
  const zeilen = abschnittZeilen(body, 'Status')
  if (zeilen === null) return null
  let imCodeblock = false
  let anzahl = 0
  for (const zeile of zeilen) {
    if (/^\s*(```|~~~)/.test(zeile)) {
      imCodeblock = !imCodeblock
      continue
    }
    if (!imCodeblock && zeile.trim() !== '') anzahl += 1
  }
  return anzahl
}

function utcTag(jahr: number, monat: number, tag: number): number | null {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null
  const zeit = Date.UTC(jahr, monat - 1, tag)
  // 31.02. rollt in JS still in den Maerz — das ist kein Datum.
  return new Date(zeit).getUTCDate() === tag ? zeit : null
}

function heuteUtc(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

/**
 * Alle Datumsangaben einer Zeile als UTC-Tage. Formen: `JJJJ-MM-TT`,
 * `TT.MM.JJJJ`, `TT.MM.` und `TT.MM` (der Beleg der Wunschliste schreibt
 * „16.09 Treffen" ohne Schlusspunkt). Tag und Monat ZWEISTELLIG und nicht
 * direkt hinter Buchstabe/Ziffer/Punkt — sonst wuerden `v2.5` oder `12.340 €`
 * zu Terminen. Ohne Jahr gilt das Jahr, das dem Scan-Tag am naechsten liegt
 * (im Dezember ist „10.01." der kommende Jaenner, im Jaenner „15.12." der
 * vergangene Dezember).
 */
export function datumsangaben(text: string, now: Date): number[] {
  const treffer: number[] = []
  for (const m of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const zeit = utcTag(Number(m[1]), Number(m[2]), Number(m[3]))
    if (zeit !== null) treffer.push(zeit)
  }
  const heute = heuteUtc(now)
  for (const m of text.matchAll(/(?<![\w.,])(\d{2})\.(\d{2})(?:\.(\d{4})(?!\d)|\.(?!\d)|(?![\d.]))/g)) {
    const tag = Number(m[1])
    const monat = Number(m[2])
    if (m[3] !== undefined) {
      const zeit = utcTag(Number(m[3]), monat, tag)
      if (zeit !== null) treffer.push(zeit)
      continue
    }
    const jahr = now.getUTCFullYear()
    const kandidaten = [jahr - 1, jahr, jahr + 1]
      .map((j) => utcTag(j, monat, tag))
      .filter((zeit): zeit is number => zeit !== null)
    if (kandidaten.length === 0) continue
    treffer.push(kandidaten.reduce((a, b) => (Math.abs(b - heute) < Math.abs(a - heute) ? b : a)))
  }
  return treffer
}

/**
 * Nimmt Verweise aus dem Text, bevor nach Terminen gesucht wird (Prueflauf
 * 18.09.2026): Ereignisordner und Notizen beginnen per Konvention mit dem
 * Datum — `[[2026-09-08 Besprechung … — Notiz]]` ist ein Linkziel, kein
 * Termin. Ohne das traefe die Regel JEDEN offenen Punkt, der — wie verlangt —
 * auf sein Detail verlinkt. Entfernt werden Wikilinks ganz und Markdown-Links
 * samt Anzeigetext (der traegt meist denselben Dateinamen).
 */
export function ohneVerweise(text: string): string {
  return text.replace(/!?\[\[[^\]]*\]\]/g, ' ').replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
}

export interface UeberholterPunkt {
  /** Die Zeile WOERTLICH (erste Zeile des Punkts) — per Textsuche auffindbar. */
  zeile: string
  tageVorbei: number
}

/**
 * Offene Punkte (`- [ ]`) unter „## Nächste Schritte", deren JUENGSTES Datum
 * mindestens `abTagen` Tage zurueckliegt. Nennt ein Punkt eine Spanne
 * („17.09–09.10"), zaehlt deren Ende — ueberholt ist er erst, wenn alles
 * vorbei ist. Eingerueckte Folgezeilen gehoeren zum Punkt.
 */
export function ueberholtePunkte(body: string, now: Date, abTagen: number): UeberholterPunkt[] {
  const zeilen = abschnittZeilen(body, 'Nächste Schritte')
  if (zeilen === null) return []
  const punkte: Array<{ zeile: string; text: string }> = []
  let offen = false
  for (const zeile of zeilen) {
    if (/^\s*- \[ \] /.test(zeile)) {
      punkte.push({ zeile: zeile.trim(), text: zeile })
      offen = true
    } else if (/^\s*- /.test(zeile) || zeile.trim() === '') {
      offen = false
    } else if (offen && /^\s+/.test(zeile)) {
      punkte[punkte.length - 1].text += ` ${zeile.trim()}`
    }
  }
  const heute = heuteUtc(now)
  const ergebnis: UeberholterPunkt[] = []
  for (const punkt of punkte) {
    const daten = datumsangaben(ohneVerweise(punkt.text), now)
    if (daten.length === 0) continue
    const tageVorbei = Math.round((heute - Math.max(...daten)) / TAG_MS)
    if (tageVorbei >= abTagen && tageVorbei > 0) ergebnis.push({ zeile: punkt.zeile, tageVorbei })
  }
  return ergebnis
}

export type TerminStand =
  | { art: 'ohne_angabe' }
  | { art: 'unlesbar'; roh: string }
  | { art: 'gelesen'; roh: string; tageVorbei: number }

/** `naechster_termin` (`JJJJ-MM-TT`, oder `JJJJ-MM` = Monatsende) gegen den Scan-Tag. */
export function leseNaechstenTermin(roh: string | null, now: Date): TerminStand {
  if (roh === null) return { art: 'ohne_angabe' }
  const voll = roh.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const monat = roh.match(/^(\d{4})-(\d{2})$/)
  let zeit: number | null = null
  if (voll) zeit = utcTag(Number(voll[1]), Number(voll[2]), Number(voll[3]))
  else if (monat && Number(monat[2]) >= 1 && Number(monat[2]) <= 12) zeit = Date.UTC(Number(monat[1]), Number(monat[2]), 0)
  if (zeit === null) return { art: 'unlesbar', roh }
  return { art: 'gelesen', roh, tageVorbei: Math.round((heuteUtc(now) - zeit) / TAG_MS) }
}
