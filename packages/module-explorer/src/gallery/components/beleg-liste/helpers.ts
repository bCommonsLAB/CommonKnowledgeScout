/**
 * Reine Helfer der Belegliste (D3, Plan `story-dreiteilung-fragenchronik`).
 *
 * Aus den Referenzen einer Antwort (eine je Textstelle, `DocReference`) wird
 * je Dokument EIN Beleg: die Dokumentnummer (D12k, dieselbe wie im
 * Antworttext — `dokumentNummern` aus `@ks/util`), der Titel, der Kurztext
 * und — aus der Konfig des Detailansichtstyps (`belegKarte` in der Registry)
 * — die Status-Plakette und die Kennzeile. Nichts hier kennt eine bestimmte
 * Library.
 */

import {
  VIEW_TYPE_REGISTRY,
  isDetailViewType,
  type BelegKarteConfig,
  type BelegPlakette,
  type DetailViewType,
  type DocCardMeta,
  type DocPassage,
  type DocReference,
} from '@ks/contracts'
import { dokumentNummern } from '@ks/util'

export interface Beleg {
  fileId: string
  /** Dokumentnummer (D12k): die Marke im Antworttext, auch bei alten Antworten mit Nummer je Textstelle. Ohne Antwort (D12q, Bestand) keine. */
  nummer?: number
  titel: string
  /**
   * Kurztext: die Begruendung der ersten Referenz (warum das Dokument
   * zitiert wurde). Die Zusammenfassung aus dem Frontmatter (`summary`)
   * erreicht die Galerie-Karte (`DocCardMeta`) heute nicht — sobald sie es
   * tut, gehoert sie hierher (Plan, Stand D3). Leer, wenn die Referenz keine
   * Begruendung traegt: kein Platzhalter.
   */
  kurztext?: string
  /** Detailansichtstyp: Dokument vor Referenz vor Library-Konfig; `null`, wenn keiner gueltig ist. */
  typ: DetailViewType | null
  /** D7: die zitierten Textstellen (Seite nur bei Quellen mit Seitenankern); leer bei alten Antworten. */
  passages: DocPassage[]
  /** Das Dokument aus dem Galerie-Bestand, falls geladen. */
  doc?: DocCardMeta
}

function gueltigerTyp(...kandidaten: Array<string | undefined>): DetailViewType | null {
  for (const k of kandidaten) if (isDetailViewType(k)) return k
  return null
}

/**
 * Zahl der belegten Dokumente (D12h): Alte Antworten (vor D7) nummerieren je
 * Textstelle, mehrere Referenzen zeigen dann auf dasselbe Dokument — der
 * Zaehler der Quellen-Leiste meint Dokumente, nicht Textstellen.
 */
export function anzahlBelegDokumente(references: Pick<DocReference, 'fileId'>[]): number {
  return new Set(references.map((r) => r.fileId)).size
}

/** Ein Beleg je Dokument, sortiert nach Dokumentnummer (Reihenfolge der ersten Nennung). */
export function belegeAusReferenzen(
  references: DocReference[],
  docs: DocCardMeta[],
  libraryDetailViewType?: string,
): Beleg[] {
  const nummern = dokumentNummern(references)
  const nachDatei = new Map<string, DocReference[]>()
  for (const ref of references) {
    const liste = nachDatei.get(ref.fileId)
    if (liste) liste.push(ref)
    else nachDatei.set(ref.fileId, [ref])
  }
  const belege = Array.from(nachDatei.entries()).map(([fileId, refs]): Beleg & { nummer: number } => {
    const doc = docs.find((d) => d.fileId === fileId || d.id === fileId)
    const erste = [...refs].sort((a, b) => a.number - b.number)[0]
    // Jede Referenz der Datei liegt in der Map — `dokumentNummern` kennt genau diese Referenzen.
    const nummer = nummern.get(erste.number) as number
    return {
      fileId,
      nummer,
      titel: doc?.title ?? doc?.shortTitle ?? erste.title ?? erste.fileName ?? fileId,
      kurztext: erste.description.trim() !== '' ? erste.description : undefined,
      typ: gueltigerTyp(doc?.detailViewType, erste.detailViewType, libraryDetailViewType),
      passages: refs.flatMap((r) => r.passages ?? []),
      doc,
    }
  })
  return belege.sort((a, b) => a.nummer - b.nummer)
}

/** D12q: Ein Dokument des Bestands als Beleg ohne Marke — dieselbe Karte wie unter einer Antwort. */
export function belegAusDokument(doc: DocCardMeta, libraryDetailViewType?: string): Beleg {
  const fileId = doc.fileId ?? doc.id
  return {
    fileId,
    titel: doc.title ?? doc.shortTitle ?? doc.fileName ?? fileId,
    typ: gueltigerTyp(doc.detailViewType, libraryDetailViewType),
    passages: [],
    doc,
  }
}

/** Die Belegkarten-Konfig des Typs — `undefined`, wenn der Typ keine hat. */
export function belegKonfig(typ: DetailViewType | null): BelegKarteConfig | undefined {
  return typ ? VIEW_TYPE_REGISTRY[typ].belegKarte : undefined
}

export type PlaketteErgebnis = { art: 'plakette'; plakette: BelegPlakette } | { art: 'roh'; wert: string }

/**
 * Status-Plakette eines Belegs. `null`, wenn der Typ keine Status-Konfig hat,
 * das Dokument nicht geladen ist oder das Feld leer ist (Block faellt weg).
 * Ein Wert ohne Zuordnung kommt roh zurueck — er wird gezeigt, nicht geraten.
 */
export function plaketteFuer(konfig: BelegKarteConfig | undefined, doc: DocCardMeta | undefined): PlaketteErgebnis | null {
  if (!konfig?.status || !doc) return null
  const wert = (doc as unknown as Record<string, unknown>)[konfig.status.field]
  if (typeof wert !== 'string' || wert.trim() === '') return null
  const plakette = konfig.status.plaketten[wert]
  return plakette ? { art: 'plakette', plakette } : { art: 'roh', wert }
}

/** Kennzeile eines Belegs: die gefuellten Felder der Konfig als Texte; leer, wenn nichts da ist. */
export function kennzeileFuer(konfig: BelegKarteConfig | undefined, doc: DocCardMeta | undefined): string[] {
  if (!konfig?.kennzeile || !doc) return []
  const werte = doc as unknown as Record<string, unknown>
  const teile: string[] = []
  for (const feld of konfig.kennzeile) {
    const wert = werte[feld]
    if (typeof wert === 'string' && wert.trim() !== '') teile.push(wert)
    else if (typeof wert === 'number') teile.push(String(wert))
    else if (Array.isArray(wert)) {
      const texte = wert.filter((w): w is string => typeof w === 'string' && w.trim() !== '')
      if (texte.length > 0) teile.push(texte.join(', '))
    }
  }
  return teile
}

/** Erste Seite eines Belegs — fuer „Original ansehen"; `undefined`, wenn keine Textstelle eine hat. */
export function ersteSeite(beleg: Pick<Beleg, 'passages'>): number | undefined {
  return beleg.passages.find((p) => typeof p.page === 'number')?.page
}
