/**
 * @fileoverview PDF-Anhaenge einer Sammeldatei aus ihren Quellen rechnen und
 * Markdown-Links auf die veroeffentlichte Adresse umschreiben (Welle J4).
 *
 * @description
 * Fehlt `attachments_url` im Frontmatter, listet der Ingest alle PDF-Quellen
 * der Sammeldatei (`compositeSources`) in der Reihenfolge Folien, weitere
 * Unterlagen, Einladung/Flyer. Die Eintraege sind zunaechst die Dateinamen
 * der Quellen; `attachments_names` traegt dieselben Namen als Anzeigename.
 * Die Blob-Veroeffentlichung uebernimmt der bestehende STUFE-2-Schritt des
 * Ingests (`uploadPdfToScope`), der hier ueber `sourceId` statt ueber eine
 * Namenssuche im Ordner an die Datei kommt — eine Streaming-URL kaeme nicht
 * in Frage, weil sie Anmeldung verlangt und die Galerie oeffentlich ist.
 *
 * Markdown-Links im Body, die auf den Dateinamen zeigen (`[Flyer](Einladung.pdf)`),
 * werden auf dieselbe Adresse umgeschrieben; alles andere bleibt unangetastet.
 *
 * @module ingestion
 */

import { istFlyer, istPdf, seitenbilder, type QuellenTwin } from '@/lib/ingestion/quellen-fragmente'

export interface AnhangQuelle {
  sourceId: string
  name: string
}

/** PDF-Quellen in Anzeige-Reihenfolge: Folien (meiste Seitenbilder), Unterlagen, Flyer zuletzt. */
export function anhaengeAusQuellen(quellen: QuellenTwin[]): AnhangQuelle[] {
  const pdfs = quellen.filter((q) => !q.eigener && istPdf(q) && q.sourceName.trim() !== '')
  const ohneFlyer = pdfs.filter((q) => !istFlyer(q))
  const flyer = pdfs.filter((q) => istFlyer(q))
  // Die geordnete Liste hat PDFs schon nach Seitenbildern sortiert; hier nur
  // Flyer ans Ende. Ein PDF ohne Seitenbilder (Extraktion fehlt) bleibt dabei —
  // der Anhang ist die Datei, nicht ihre Bilder.
  const folienZuerst = [...ohneFlyer].sort((a, b) => seitenbilder(b) - seitenbilder(a))
  return [...folienZuerst, ...flyer].map((q) => ({ sourceId: q.sourceId, name: q.sourceName }))
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Ersetzt in Markdown-Links das Ziel `name` (auch `./name` oder URL-kodiert)
 * durch `url`. Liefert den neuen Text und die Zahl der Ersetzungen.
 */
export function ersetzePdfLinks(markdown: string, adressen: ReadonlyMap<string, string>): { markdown: string; ersetzt: number } {
  let ersetzt = 0
  let out = markdown
  for (const [name, url] of adressen) {
    if (!name || !url || !/^https?:\/\//i.test(url)) continue
    const ziele = [...new Set([name, encodeURI(name), name.replace(/ /g, '%20')])].map(escapeRegExp).join('|')
    const re = new RegExp(`(\\]\\()(?:\\./)?(?:${ziele})(\\s*(?:"[^"]*")?\\))`, 'g')
    out = out.replace(re, (_m, vor: string, nach: string) => { ersetzt += 1; return `${vor}${url}${nach}` })
  }
  return { markdown: out, ersetzt }
}
