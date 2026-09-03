/**
 * @fileoverview Korrekturauftraege sammeln und verdichten (K4) — pur.
 *
 * @description
 * Zwei Verdichtungsgrade fuer EIN Werkzeug (`korrekturen_lesen`), damit beide
 * Arbeitsweisen ohne Widerspruch nebeneinander stehen:
 *
 * - **Uebersicht** (ohne Ordner): je Ordner EINE Zeile — Anzahl, aeltester
 *   Auftrag, ein Auszug. Damit entscheidet man, WO man anfaengt, ohne in jedes
 *   Verzeichnis zu schauen und ohne die Volltexte zu laden.
 * - **Arbeitsliste** (mit Ordner): die Auftraege dieses Teilbaums im Volltext.
 *   Beim Aufraeumen von `25.11` faengt man sich so nichts aus `26.02` ein.
 *
 * Gelesen wird dasselbe Frontmatter, aus dem auch `checkKorrekturOffen` den
 * Befund baut (`twin-rules.ts`) — eine Wahrheit, kein Index-Feld daneben.
 *
 * Reine Funktionen, kein I/O: Der Pfad wird von aussen hereingereicht (die
 * Bruecke loest ihn nur fuer die TREFFER auf, nicht fuer die ganze Library).
 *
 * @module agent-view
 */

import type { KorrekturRohZeile } from '@/lib/repositories/shadow-twin-repo'

/** Ein offener Korrekturauftrag an genau EINEM Artefakt. */
export interface Korrekturauftrag {
  sourceId: string
  sourceName: string
  /** Ordner der Quelle — Pfad liefert der Aufrufer nach (siehe Modul-Doku). */
  parentId: string
  /** Artefakt-Referenz fuer `korrektur_melden` und die Kurations-Route. */
  kind: 'transcript' | 'transformation'
  templateName: string | null
  targetLanguage: string
  auftrag: string
  von: string | null
  at: string | null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Offen = Auftrag vorhanden UND kein Agent hat Vollzug gemeldet. */
function offenerAuftrag(frontmatter: Record<string, unknown> | null | undefined): string | null {
  if (!frontmatter) return null
  const auftrag = text(frontmatter['korrektur_auftrag'])
  if (auftrag === null) return null
  return text(frontmatter['korrektur_erledigt_at']) === null ? auftrag : null
}

/**
 * Rohzeilen der Mongo-Abfrage → offene Auftraege, je Artefakt einer.
 * Erledigte fallen weg; sie sind kein Auftrag mehr, sondern warten auf Peters
 * Blick (und der laeuft ueber die Werkbank, nicht ueber die Bruecke).
 */
export function sammleKorrekturen(zeilen: readonly KorrekturRohZeile[]): Korrekturauftrag[] {
  const auftraege: Korrekturauftrag[] = []
  for (const zeile of zeilen) {
    const basis = { sourceId: zeile.sourceId, sourceName: zeile.sourceName, parentId: zeile.parentId }

    const transkript = offenerAuftrag(zeile.transkript)
    if (transkript !== null) {
      auftraege.push({
        ...basis,
        kind: 'transcript',
        templateName: null,
        targetLanguage: '',
        auftrag: transkript,
        von: text(zeile.transkript?.['korrektur_von']),
        at: text(zeile.transkript?.['korrektur_at']),
      })
    }

    for (const gruppe of zeile.transformationen ?? []) {
      for (const eintrag of gruppe.sprachen) {
        const auftrag = offenerAuftrag(eintrag.frontmatter)
        if (auftrag === null) continue
        auftraege.push({
          ...basis,
          kind: 'transformation',
          templateName: gruppe.template,
          targetLanguage: eintrag.sprache,
          auftrag,
          von: text(eintrag.frontmatter?.['korrektur_von']),
          at: text(eintrag.frontmatter?.['korrektur_at']),
        })
      }
    }
  }
  return auftraege
}

/** Ein Auftrag mit aufgeloestem, library-relativem Ordnerpfad. */
export interface KorrekturMitPfad extends Korrekturauftrag {
  /** Ordnerpfad; leer, wenn er sich nicht aufloesen liess (benannt, nicht geraten). */
  ordnerPfad: string
}

/** Zeile der Uebersicht: ein Ordner, verdichtet auf das Noetige. */
export interface KorrekturUebersichtZeile {
  ordnerPfad: string
  folderId: string
  offen: number
  /** Aeltester Auftrag des Ordners (ISO); null, wenn keiner ein Datum traegt. */
  aeltester: string | null
  /** Erster Auftragstext, gekuerzt — der Blick, der die Auswahl traegt. */
  auszug: string
}

/** Laenge des Auszugs in der Uebersicht — eine Zeile im Terminal. */
export const AUSZUG_LAENGE = 80

function kuerze(auftrag: string): string {
  return auftrag.length <= AUSZUG_LAENGE ? auftrag : `${auftrag.slice(0, AUSZUG_LAENGE - 1)}…`
}

/**
 * Verdichtet die Auftraege zu je einer Zeile pro Ordner, die vollsten zuerst
 * (bei Gleichstand der aeltere Auftrag) — die Reihenfolge ist die
 * Empfehlung, wo anzufangen ist.
 */
export function verdichteNachOrdner(
  auftraege: readonly KorrekturMitPfad[],
): KorrekturUebersichtZeile[] {
  const proOrdner = new Map<string, KorrekturMitPfad[]>()
  for (const auftrag of auftraege) {
    const liste = proOrdner.get(auftrag.parentId)
    if (liste) liste.push(auftrag)
    else proOrdner.set(auftrag.parentId, [auftrag])
  }

  const zeilen: KorrekturUebersichtZeile[] = []
  for (const [folderId, liste] of proOrdner) {
    const datierte = liste.map((auftrag) => auftrag.at).filter((at): at is string => at !== null).sort()
    zeilen.push({
      ordnerPfad: liste[0].ordnerPfad,
      folderId,
      offen: liste.length,
      aeltester: datierte[0] ?? null,
      auszug: kuerze(liste[0].auftrag),
    })
  }

  return zeilen.sort((a, b) => {
    if (b.offen !== a.offen) return b.offen - a.offen
    return (a.aeltester ?? '').localeCompare(b.aeltester ?? '')
  })
}
