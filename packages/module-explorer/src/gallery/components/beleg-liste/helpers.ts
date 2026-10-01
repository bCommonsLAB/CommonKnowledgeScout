/**
 * Reine Helfer der Belegliste (D3, Plan `story-dreiteilung-fragenchronik`).
 *
 * Aus den Referenzen einer Antwort (eine je Textstelle, `DocReference`) wird
 * je Dokument EIN Beleg: die Fussnoten-Nummern, der Titel, der Kurztext und —
 * aus der Konfig des Detailansichtstyps (`belegKarte` in der Registry) — die
 * Status-Plakette und die Kennzeile. Nichts hier kennt eine bestimmte Library.
 */

import {
  VIEW_TYPE_REGISTRY,
  isDetailViewType,
  type BelegKarteConfig,
  type BelegPlakette,
  type DetailViewType,
  type DocCardMeta,
  type DocReference,
} from '@ks/contracts'

export interface Beleg {
  fileId: string
  /** Fussnoten-Nummern dieser Quelle im Antworttext, aufsteigend, ohne Dubletten. */
  nummern: number[]
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
  /** Das Dokument aus dem Galerie-Bestand, falls geladen. */
  doc?: DocCardMeta
}

function gueltigerTyp(...kandidaten: Array<string | undefined>): DetailViewType | null {
  for (const k of kandidaten) if (isDetailViewType(k)) return k
  return null
}

/** Ein Beleg je Dokument, in der Reihenfolge der ersten Nennung. */
export function belegeAusReferenzen(
  references: DocReference[],
  docs: DocCardMeta[],
  libraryDetailViewType?: string,
): Beleg[] {
  const nachDatei = new Map<string, DocReference[]>()
  for (const ref of references) {
    const liste = nachDatei.get(ref.fileId)
    if (liste) liste.push(ref)
    else nachDatei.set(ref.fileId, [ref])
  }
  return Array.from(nachDatei.entries()).map(([fileId, refs]) => {
    const doc = docs.find((d) => d.fileId === fileId || d.id === fileId)
    const erste = refs[0]
    const nummern = Array.from(new Set(refs.map((r) => r.number))).sort((a, b) => a - b)
    return {
      fileId,
      nummern,
      titel: doc?.title ?? doc?.shortTitle ?? erste.fileName ?? fileId,
      kurztext: erste.description.trim() !== '' ? erste.description : undefined,
      typ: gueltigerTyp(doc?.detailViewType, erste.detailViewType, libraryDetailViewType),
      doc,
    }
  })
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
