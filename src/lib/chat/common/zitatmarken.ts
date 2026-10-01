/**
 * Zitatmarken je Dokument (D7, Plan `story-dreiteilung-fragenchronik`).
 *
 * Bis D6 bekam jede gefundene Textstelle (Chunk) eine eigene Nummer: Treffer
 * 1..n wurden zu [1]..[n], zwei Stellen aus demselben Dokument zu zwei
 * Nummern — die Nummern im Text passten nicht zur Belegliste, die nach
 * Dokument gruppiert. Seit D7 wird je DOKUMENT nummeriert (Reihenfolge der
 * ersten Nennung), die Textstellen haengen als `passages` unter dem Beleg.
 *
 * Reine Funktionen (chat-contracts §1): Prompt und Orchestrator rufen
 * dieselbe Nummerierung, der Cache-Hash bleibt unberuehrt (Darstellung).
 */

import type { DocPassage, DocReference } from '@ks/contracts'
import type { RetrievedSource } from '@/types/retriever'

export const EXCERPT_MAX_CHARS = 160

export interface DokumentGruppe {
  nummer: number
  fileId: string
  fileName?: string
  /** Die Textstellen dieses Dokuments in Trefferreihenfolge. */
  sources: RetrievedSource[]
}

/** fileId einer Quelle — wie der Retriever sie liefert, sonst aus der Kennung. */
export function fileIdVonQuelle(source: RetrievedSource): string {
  return source.fileId || source.id.split('-')[0]
}

/** Dokumente in Reihenfolge der ersten Nennung, Nummern ab 1. */
export function dokumenteNummerieren(sources: RetrievedSource[]): DokumentGruppe[] {
  const gruppen: DokumentGruppe[] = []
  const index = new Map<string, DokumentGruppe>()
  for (const source of sources) {
    const fileId = fileIdVonQuelle(source)
    const bekannt = index.get(fileId)
    if (bekannt) {
      bekannt.sources.push(source)
      if (!bekannt.fileName && source.fileName) bekannt.fileName = source.fileName
      continue
    }
    const gruppe: DokumentGruppe = { nummer: gruppen.length + 1, fileId, fileName: source.fileName, sources: [source] }
    gruppen.push(gruppe)
    index.set(fileId, gruppe)
  }
  return gruppen
}

/** Nummer eines Dokuments fuer eine Quelle; `undefined`, wenn die Quelle nicht in den Gruppen ist. */
export function nummerFuerQuelle(gruppen: DokumentGruppe[], source: RetrievedSource): number | undefined {
  const fileId = fileIdVonQuelle(source)
  return gruppen.find((g) => g.fileId === fileId)?.nummer
}

/** Zitat-Ausschnitt: Anfang des Chunks, an der Wortgrenze gekuerzt, ohne Zeilenumbrueche. */
export function excerpt(text: string, max = EXCERPT_MAX_CHARS): string {
  const flach = text.replace(/\s+/g, ' ').trim()
  if (flach.length <= max) return flach
  const schnitt = flach.lastIndexOf(' ', max)
  return `${flach.slice(0, schnitt > max / 2 ? schnitt : max).trimEnd()}…`
}

/**
 * Belege aus den Gruppen: einer je Dokument, mit Textstellen. `benutzt`
 * sind die Dokument-Nummern, die das Sprachmodell zitiert hat; leer heisst
 * alle (wie bisher: lieber alle zeigen als keine).
 */
export function belegeAusGruppen(
  gruppen: DokumentGruppe[],
  benutzt: number[],
  beschreibung: (source: RetrievedSource) => string,
): DocReference[] {
  const nur = benutzt.length > 0 ? new Set(benutzt) : null
  return gruppen
    .filter((g) => nur === null || nur.has(g.nummer))
    .map((g) => {
      const passages: DocPassage[] = g.sources.map((s) => ({
        ...(typeof s.chunkIndex === 'number' ? { chunkIndex: s.chunkIndex } : {}),
        ...(typeof s.page === 'number' ? { page: s.page } : {}),
        excerpt: excerpt(s.text ?? ''),
      }))
      const beschreibungen = Array.from(new Set(g.sources.map(beschreibung)))
      return {
        number: g.nummer,
        fileId: g.fileId,
        fileName: g.fileName,
        description: beschreibungen.join('; '),
        passages,
      }
    })
}
