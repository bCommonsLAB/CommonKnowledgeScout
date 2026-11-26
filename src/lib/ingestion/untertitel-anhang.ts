/**
 * @fileoverview Untertitel einer Quelle als einsehbaren Anhang am Dokument veroeffentlichen.
 *
 * @description
 * Der Ingest bettet die Transkripte der verbundenen Quellen als unsichtbaren
 * Anhang ein (`ingest-source-appendix.ts`); der Story-Modus zitiert daraus. Bei
 * Transkripten aus fertigen Untertiteln (`transcript_origin: subtitles`, Weg
 * `transkript: "untertitel"`) kann die Leserin die zitierte Quelle damit nicht
 * nachsehen. Mit dem Schalter `attachments_subtitles: true` im Frontmatter
 * (Vorlage als festes Feld oder `dokument_felder_setzen`) haengt der Ingest je
 * Untertitel-Quelle ein Textdokument „Untertitel von <Anbieter>" an die Anhaenge.
 *
 * - Veroeffentlicht wird das Transkript vom TWIN der Quelle, nicht die Datei im
 *   Ordner: Das ist der Text, den der Story-Modus zitiert, samt Korrekturen
 *   (`transkript_korrigieren`).
 * - Vorgabe ist AUS. Ein Transkript ganz zu zeigen ist eine Rechte-Entscheidung
 *   der Library; der unsichtbare Anhang bleibt davon unberuehrt.
 * - Erkannt wird die Quelle an der Herkunft im Frontmatter ihres Transkripts,
 *   nicht am Dateinamen.
 *
 * @module ingestion
 */

import { parseFrontmatter, stripAllFrontmatter } from '@/lib/markdown/frontmatter'
import { getShadowTwinsBySourceIds, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'
import type { QuellenTwin } from '@/lib/ingestion/quellen-fragmente'

export interface UntertitelAnhang {
  sourceId: string
  /** Dateiname im Blob-Speicher: der Name der Quelle, immer auf `.txt`. */
  dateiname: string
  /** Anzeigename in der Anhangsliste, z. B. „Untertitel von YouTube". */
  titel: string
  /** Inhalt des Dokuments: zwei Kopfzeilen zur Herkunft, dann das Transkript. */
  text: string
}

/**
 * Schalter `attachments_subtitles` im Frontmatter: `true` haengt Untertitel-Transkripte als
 * Textdokument an. Fehlt das Feld, gilt false. Ein anderer Wert ist ein Fehler, kein false.
 */
export function untertitelAnhangErlaubt(meta: Record<string, unknown>): boolean {
  const wert = meta['attachments_subtitles']
  if (wert === undefined || wert === null || wert === '') return false
  if (wert === true || wert === 'true') return true
  if (wert === false || wert === 'false') return false
  throw new Error(`attachments_subtitles: "${String(wert)}" ist weder true noch false`)
}

function feld(meta: Record<string, unknown>, name: string): string {
  const wert = meta[name]
  return typeof wert === 'string' ? wert.trim() : ''
}

/** „Untertitel von YouTube"; ohne bekannten Anbieter nur „Untertitel" — nichts wird geraten. */
export function untertitelTitel(anbieter: string): string {
  return anbieter ? `Untertitel von ${anbieter}` : 'Untertitel'
}

/**
 * Baut den Anhang aus dem Transkript einer Quelle. `null`, wenn das Transkript nicht aus
 * Untertiteln stammt. Wirft, wenn es aus Untertiteln stammt, aber keinen Text traegt.
 */
export function untertitelAnhangAusTranskript(sourceId: string, sourceName: string, markdown: string): UntertitelAnhang | null {
  const { meta } = parseFrontmatter(markdown)
  if (feld(meta, 'transcript_origin') !== 'subtitles') return null
  const body = stripAllFrontmatter(markdown).trim()
  if (!body) throw new Error(`Untertitel-Transkript von "${sourceName}" ist leer`)
  const anbieter = feld(meta, 'subtitle_provider')
  const art = feld(meta, 'subtitle_kind')
  const angaben = [
    art === 'manual' ? 'von Hand gepflegt' : art === 'automatic' ? 'automatisch erzeugt' : '',
    feld(meta, 'subtitle_language') ? `Sprache ${feld(meta, 'subtitle_language')}` : '',
    feld(meta, 'subtitle_fetched_at') ? `abgerufen am ${feld(meta, 'subtitle_fetched_at').slice(0, 10)}` : '',
    feld(meta, 'revised_at') ? `korrigiert am ${feld(meta, 'revised_at').slice(0, 10)}` : '',
  ].filter((teil) => teil.length > 0)
  const titel = untertitelTitel(anbieter)
  const kopf = [`${titel}${angaben.length > 0 ? ` (${angaben.join(', ')})` : ''}`]
  if (feld(meta, 'source_url')) kopf.push(`Quelle: ${feld(meta, 'source_url')}`)
  const basis = sourceName.replace(/\.[^./\\]+$/, '').trim() || 'Untertitel'
  return { sourceId, dateiname: `${basis}.txt`, titel, text: `${kopf.join('\n')}\n\n${body}\n` }
}

/** Untertitel-Anhaenge der verbundenen Quellen einer Sammeldatei, in deren Reihenfolge. */
export async function ladeUntertitelAnhaenge(libraryId: string, quellen: ReadonlyArray<QuellenTwin>): Promise<UntertitelAnhang[]> {
  const fremde = quellen.filter((q) => !q.eigener)
  if (fremde.length === 0) return []
  const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: fremde.map((q) => q.sourceId) })
  const anhaenge: UntertitelAnhang[] = []
  for (const quelle of fremde) {
    const record = readTranscriptRecord(docs.get(quelle.sourceId))
    if (!record) continue
    const anhang = untertitelAnhangAusTranskript(quelle.sourceId, quelle.sourceName, record.markdown)
    if (anhang) anhaenge.push(anhang)
  }
  return anhaenge
}

/**
 * Haengt Eintraege an `attachments_url` / `attachments_names` an und haelt beide Listen gleich lang.
 * Ein schon vorhandener Eintrag mit derselben Adresse wird nicht verdoppelt (zweiter Ingest).
 */
export function haengeAnhaengeAn(docMeta: Record<string, unknown>, neu: ReadonlyArray<{ url: string; name: string }>): void {
  if (neu.length === 0) return
  const roh = docMeta['attachments_url']
  const urls: unknown[] = Array.isArray(roh) ? [...roh] : typeof roh === 'string' && roh.trim() ? [roh] : []
  const rohNamen = docMeta['attachments_names']
  const namen: unknown[] = urls.map((url, i) => {
    const name = Array.isArray(rohNamen) ? rohNamen[i] : undefined
    if (typeof name === 'string' && name) return name
    return typeof url === 'string' ? url.split('/').filter(Boolean).pop() ?? url : url
  })
  for (const eintrag of neu) {
    if (urls.includes(eintrag.url)) continue
    urls.push(eintrag.url)
    namen.push(eintrag.name)
  }
  docMeta['attachments_url'] = urls
  docMeta['attachments_names'] = namen
}
