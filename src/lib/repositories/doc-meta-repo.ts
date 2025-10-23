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
    await Promise.all([
      col.createIndex({ fileId: 1 }, { name: 'fileId' }),
      col.createIndex({ upsertedAt: -1 }, { name: 'upsertedAt_desc' }),
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

export async function findDocs(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  options: FindDocsOptions = {}
): Promise<Array<{ id: string; fileId: string; fileName?: string; title?: string; shortTitle?: string; authors?: string[]; year?: number | string; region?: string; upsertedAt?: string; docType?: string; source?: string; tags?: string[] }>> {
  const col = await getDocMetaCollection(libraryKey)
  const q: Record<string, unknown> = { libraryId, ...(filter || {}) }
  const cursor = col.find(q, {
    projection: {
      _id: 0,
      libraryId: 1,
      fileId: 1,
      fileName: 1,
      authors: 1,
      year: 1,
      region: 1,
      docType: 1,
      source: 1,
      tags: 1,
      upsertedAt: 1,
      docMetaJson: 1,
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
    return {
      id: `${r.fileId}-meta`,
      fileId: r.fileId,
      fileName: r.fileName,
      title,
      shortTitle,
      authors: Array.isArray(r.authors) ? r.authors : undefined,
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
  options: FindDocSummariesOptions = {}
): Promise<Array<{ fileId: string; fileName?: string; chaptersCount?: number; chapters?: Array<{ title?: string; summary?: string }>; docSummary?: string }>> {
  const col = await getDocMetaCollection(libraryKey)
  const q: Record<string, unknown> = { libraryId, ...(filter || {}) }
  const cursor = col.find(q, {
    projection: {
      _id: 0,
      libraryId: 1,
      fileId: 1,
      fileName: 1,
      chaptersCount: 1,
      chapters: 1,
      'docMetaJson.summary': 1,
    }
  })
  if (options.sort) cursor.sort(options.sort)
  if (typeof options.skip === 'number') cursor.skip(options.skip)
  if (typeof options.limit === 'number') cursor.limit(options.limit)
  const rows = await cursor.toArray()
  return rows.map(r => {
    const docMeta = r.docMetaJson && typeof r.docMetaJson === 'object' ? r.docMetaJson as Record<string, unknown> : undefined
    const docSummary = docMeta && typeof (docMeta as { summary?: unknown }).summary === 'string' ? (docMeta as { summary: string }).summary : undefined
    const chaptersArr = Array.isArray((r as any).chapters) ? ((r as any).chapters as Array<any>).map(c => ({
      title: typeof c?.title === 'string' ? c.title : undefined,
      summary: typeof c?.summary === 'string' ? c.summary : undefined,
    })) : undefined
    return {
      fileId: r.fileId,
      fileName: r.fileName,
      chaptersCount: typeof (r as any).chaptersCount === 'number' ? Number((r as any).chaptersCount) : undefined,
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
  const rows = await col.find(
    { libraryId, fileId: { $in: fileIds } },
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
  const match: Record<string, unknown> = { libraryId, ...(filter || {}) }
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


