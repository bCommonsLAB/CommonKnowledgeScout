import type { Collection, Document } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { DocMeta } from '@/types/doc-meta'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import crypto from 'crypto'
const colCache = new Map<string, Collection<DocMeta>>()
const ensuredIndexKeys = new Set<string>()

export function computeDocMetaCollectionName(userEmail: string, libraryId: string, strategy: 'per_library' | 'per_tenant' = 'per_library'): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60)
  if (strategy === 'per_tenant') {
    const hash = crypto.createHash('sha1').update(userEmail || '').digest('hex').slice(0, 10)
    return `doc_meta__${safe(hash)}__${safe(libraryId)}`
  }
  return `doc_meta__${safe(libraryId)}`
}

async function getDocMetaCollection(libraryKey: string): Promise<Collection<DocMeta>> {
  if (colCache.has(libraryKey)) return colCache.get(libraryKey) as Collection<DocMeta>
  const col = await getCollection<DocMeta>(libraryKey)
  try {
    // Basis-Indizes für häufig verwendete Felder
    // HINWEIS: libraryId wird NICHT indiziert, da jede Collection bereits nur Dokumente einer Library enthält
    await Promise.all([
      // Index auf fileId für Lookups
      col.createIndex({ fileId: 1 }, { name: 'fileId' }),
      // Index auf upsertedAt für Sortierung
      col.createIndex({ upsertedAt: -1 }, { name: 'upsertedAt_desc' }),
      // Verbund-Index für Sortierung nach upsertedAt (häufig verwendet)
      col.createIndex({ year: 1, upsertedAt: -1 }, { name: 'year_upsertedAt_desc' }),
    ])
  } catch {}
  colCache.set(libraryKey, col)
  return col
}

export async function ensureFacetIndexes(libraryKey: string, defs: FacetDef[]): Promise<void> {
  const col = await getDocMetaCollection(libraryKey)
  const jobs: Array<Promise<string | void>> = []
  for (const d of defs) {
    const key = d.metaKey
    if (!key) continue
    const idxName = `facet_${key}`
    const cacheKey = `${libraryKey}::${idxName}`
    if (ensuredIndexKeys.has(cacheKey)) continue
    jobs.push(col.createIndex({ [key]: 1 }, { name: idxName }).catch(() => {}))
    ensuredIndexKeys.add(cacheKey)
  }
  await Promise.all(jobs)
}

export async function upsertDocMeta(libraryKey: string, doc: DocMeta): Promise<void> {
  const col = await getDocMetaCollection(libraryKey)
  await col.updateOne(
    { libraryId: doc.libraryId, fileId: doc.fileId },
    { $set: doc },
    { upsert: true }
  )
}

export interface FindDocsOptions {
  limit?: number
  skip?: number
  sort?: Record<string, 1 | -1>
}

/**
 * Konvertiert einen Wert zu einem String-Array
 * Unterstützt:
 * - Arrays (direkt)
 * - Strings die wie Arrays aussehen: "['url1', 'url2']" → ['url1', 'url2']
 * - Einzelne Strings → [string]
 */
function toStrArr(v: unknown): string[] | undefined {
  // Direktes Array
  if (Array.isArray(v)) {
    const arr = (v as Array<unknown>).map(x => {
      if (typeof x === 'string' && x.trim().length > 0) return x.trim()
      return ''
    }).filter(Boolean)
    return arr.length > 0 ? arr : undefined
  }
  
  // String der wie ein Array aussieht: "['url1', 'url2']" oder '["url1", "url2"]'
  if (typeof v === 'string' && v.trim().length > 0) {
    const trimmed = v.trim()
    
    // Versuche JSON-Array zu parsen
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
        (trimmed.startsWith("['") && trimmed.endsWith("']"))) {
      try {
        // Ersetze einfache Anführungszeichen durch doppelte für JSON.parse
        const jsonStr = trimmed.replace(/'/g, '"')
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed)) {
          const arr = parsed.map(x => {
            if (typeof x === 'string' && x.trim().length > 0) return x.trim()
            return ''
          }).filter(Boolean)
          return arr.length > 0 ? arr : undefined
        }
      } catch {
        // Fehler beim Parsen, versuche manuell zu extrahieren
        // Pattern: ['url1', 'url2'] → ['url1', 'url2']
        const matches = trimmed.match(/(['"])((?:(?!\1).)*)\1/g)
        if (matches && matches.length > 0) {
          const arr = matches.map(m => m.slice(1, -1).trim()).filter(Boolean)
          return arr.length > 0 ? arr : undefined
        }
      }
    }
    
    // Einzelner String → als Array mit einem Element
    const singleStr = trimmed.length > 0 ? trimmed : undefined
    return singleStr ? [singleStr] : undefined
  }
  
  return undefined
}

export async function findDocs(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  options: FindDocsOptions = {}
): Promise<Array<{ id: string; fileId: string; fileName?: string; title?: string; shortTitle?: string; authors?: string[]; speakers?: string[]; speakers_image_url?: string[]; year?: number | string; region?: string; upsertedAt?: string; docType?: string; source?: string; tags?: string[] }>> {
  const col = await getDocMetaCollection(libraryKey)
  // PERFORMANCE: libraryId wird NICHT gefiltert, da die Collection bereits nur Dokumente dieser Library enthält
  // Die Collection selbst ist bereits nach Library getrennt (doc_meta__${libraryId})
  const q: Record<string, unknown> = { ...(filter || {}) }
  // PERFORMANCE: Nur benötigte Felder aus docMetaJson laden (nicht das komplette Objekt)
  // MongoDB unterstützt dot-notation für verschachtelte Felder in Projection
  const cursor = col.find(q, {
    projection: {
      _id: 0,
      libraryId: 1,
      fileId: 1,
      fileName: 1,
      authors: 1,
      speakers: 1, // Top-Level speakers Feld (für Sessions)
      speakers_image_url: 1, // Top-Level speakers_image_url Feld (für Sessions)
      year: 1,
      region: 1,
      docType: 1,
      source: 1,
      tags: 1,
      upsertedAt: 1,
      // Nur title, shortTitle, speakers und speakers_image_url aus docMetaJson laden, nicht das komplette Objekt
      'docMetaJson.title': 1,
      'docMetaJson.shortTitle': 1,
      'docMetaJson.speakers': 1, // speakers aus docMetaJson (für Sessions)
      'docMetaJson.speakers_image_url': 1, // speakers_image_url aus docMetaJson (für Sessions)
    }
  })
  if (options.sort) cursor.sort(options.sort)
  if (typeof options.skip === 'number') cursor.skip(options.skip)
  if (typeof options.limit === 'number') cursor.limit(options.limit)
  const rows = await cursor.toArray()
  return rows.map(r => {
    const docMeta = r.docMetaJson && typeof r.docMetaJson === 'object' ? r.docMetaJson as Record<string, unknown> : undefined
    const title = docMeta && typeof (docMeta as { title?: unknown }).title === 'string' ? (docMeta as { title: string }).title : undefined
    const shortTitle = docMeta && typeof (docMeta as { shortTitle?: unknown }).shortTitle === 'string' ? (docMeta as { shortTitle: string }).shortTitle : undefined
    // speakers: Priorität: Top-Level > docMetaJson.speakers
    const speakersTopLevel = Array.isArray(r.speakers) ? r.speakers : undefined
    const speakersDocMeta = docMeta && Array.isArray((docMeta as { speakers?: unknown }).speakers) 
      ? (docMeta as { speakers: string[] }).speakers 
      : undefined
    const speakers = speakersTopLevel || speakersDocMeta
    // speakers_image_url: Priorität: Top-Level > docMetaJson.speakers_image_url
    // Kann sowohl Array als auch String sein: "['url1', 'url2']" → ['url1', 'url2']
    const speakersImageUrlTopLevel = toStrArr(r.speakers_image_url)
    const speakersImageUrlDocMeta = docMeta ? toStrArr(docMeta.speakers_image_url) : undefined
    const speakersImageUrl = speakersImageUrlTopLevel || speakersImageUrlDocMeta
    return {
      id: `${r.fileId}-meta`,
      fileId: r.fileId,
      fileName: r.fileName,
      title,
      shortTitle,
      authors: Array.isArray(r.authors) ? r.authors : undefined,
      speakers: speakers ? speakers.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : undefined,
      speakers_image_url: speakersImageUrl || undefined,
      year: (typeof r.year === 'number' || typeof r.year === 'string') ? r.year : undefined,
      region: typeof r.region === 'string' ? r.region : undefined,
      upsertedAt: typeof r.upsertedAt === 'string' ? r.upsertedAt : undefined,
      docType: typeof r.docType === 'string' ? r.docType : undefined,
      source: typeof r.source === 'string' ? r.source : undefined,
      tags: Array.isArray(r.tags) ? r.tags : undefined,
    }
  })
}

export interface FindDocSummariesOptions {
  limit?: number
  skip?: number
  sort?: Record<string, 1 | -1>
}

// Liefert für Summary-Retriever die benötigten Felder direkt aus MongoDB
export async function findDocSummaries(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  options: FindDocSummariesOptions = {},
  skipChapters: boolean = false
): Promise<Array<{ fileId: string; fileName?: string; chaptersCount?: number; chapters?: Array<{ title?: string; summary?: string }>; docSummary?: string }>> {
  const col = await getDocMetaCollection(libraryKey)
  // PERFORMANCE: libraryId wird NICHT gefiltert, da die Collection bereits nur Dokumente dieser Library enthält
  const q: Record<string, unknown> = { ...(filter || {}) }
  
  // PERFORMANCE: Im Event-Modus keine Chapters laden (nur docMetaJson.summary)
  const projection: Record<string, 0 | 1> = {
    _id: 0,
    libraryId: 1,
    fileId: 1,
    fileName: 1,
    'docMetaJson.summary': 1,
  }
  if (!skipChapters) {
    projection.chaptersCount = 1
    projection.chapters = 1
  }
  
  const cursor = col.find(q, { projection })
  if (options.sort) cursor.sort(options.sort)
  if (typeof options.skip === 'number') cursor.skip(options.skip)
  if (typeof options.limit === 'number') cursor.limit(options.limit)
  const rows = await cursor.toArray()
  return rows.map(r => {
    const docMeta = r.docMetaJson && typeof r.docMetaJson === 'object' ? r.docMetaJson as Record<string, unknown> : undefined
    const docSummary = docMeta && typeof (docMeta as { summary?: unknown }).summary === 'string' ? (docMeta as { summary: string }).summary : undefined
    const rawChapters = (r as unknown as { chapters?: unknown }).chapters
    const chaptersArr = Array.isArray(rawChapters)
      ? (rawChapters as Array<unknown>).map(c => {
          const o = c && typeof c === 'object' ? c as Record<string, unknown> : {}
          return {
            title: typeof o.title === 'string' ? o.title : undefined,
            summary: typeof o.summary === 'string' ? o.summary : undefined,
          }
        })
      : undefined
    return {
      fileId: r.fileId,
      fileName: r.fileName,
      chaptersCount: typeof (r as unknown as { chaptersCount?: unknown }).chaptersCount === 'number' ? (r as unknown as { chaptersCount: number }).chaptersCount : undefined,
      chapters: chaptersArr,
      docSummary,
    }
  })
}

export async function getByFileIds(
  libraryKey: string,
  libraryId: string,
  fileIds: string[]
): Promise<Map<string, DocMeta>> {
  const col = await getDocMetaCollection(libraryKey)
  // PERFORMANCE: libraryId wird NICHT gefiltert, da die Collection bereits nur Dokumente dieser Library enthält
  const rows = await col.find(
    { fileId: { $in: fileIds } },
    { projection: { _id: 0 } }
  ).toArray()
  const map = new Map<string, DocMeta>()
  for (const r of rows) map.set(r.fileId, r)
  return map
}

export async function aggregateFacets(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  defs: Array<{ metaKey: string; type: string; label?: string }>
): Promise<Record<string, Array<{ value: string; count: number }>>> {
  const col = await getDocMetaCollection(libraryKey)
  // PERFORMANCE: libraryId wird NICHT gefiltert, da die Collection bereits nur Dokumente dieser Library enthält
  const match: Record<string, unknown> = { ...(filter || {}) }
  const facetStages: Record<string, Document[]> = {}
  for (const d of defs) {
    const key = d.metaKey
    const arr: Document[] = []
    // Null/fehlende ausschließen
    arr.push({ $match: { [key]: { $exists: true, $ne: null } } })
    if (d.type === 'string[]') arr.push({ $unwind: `$${key}` })
    arr.push({ $group: { _id: `$${key}`, count: { $sum: 1 } } })
    arr.push({ $sort: { _id: 1 } })
    facetStages[key] = arr
  }
  const pipeline: Document[] = [
    { $match: match },
    { $facet: facetStages }
  ]
  const [res] = await col.aggregate(pipeline).toArray()
  const out: Record<string, Array<{ value: string; count: number }>> = {}
  for (const d of defs) {
    const rows = Array.isArray(res?.[d.metaKey]) ? res[d.metaKey] as Array<{ _id: unknown; count: number }> : []
    out[d.metaKey] = rows
      .map(r => ({ value: String(r._id), count: Number(r.count) || 0 }))
      .filter(x => x.value.length > 0)
  }
  return out
}


