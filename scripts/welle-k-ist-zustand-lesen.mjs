/**
 * @fileoverview Ist-Zustand fuer Welle K lesen (nur lesend, Owner-Terminal).
 *
 * @description
 * Lehre aus Welle J (Plan §3c): Der Prueffall laeuft VOR dem Bauen einmal
 * gegen den Ist-Zustand. Dieses Skript liest aus einer MongoDB (per Vorgabe
 * die Prod-DB aus MONGODB_DATABASE_NAME_PROD) den juengsten Index-Job einer
 * Library (external_jobs: Trace-Ereignisse des Ingest-Spans, Schrittdetails)
 * und das Meta-Dokument derselben Quelle (doc_meta__<libraryId>, kind meta)
 * — genau die Formen, die `job_status`, `batch_bilanz` und `dokument_lesen`
 * seit 2.48.0 deuten. Es schreibt nichts.
 *
 * Aufruf (PowerShell, Repo-Root, .env vorhanden):
 *   node scripts/welle-k-ist-zustand-lesen.mjs <libraryId> [sourceId | jobId]
 * Ohne zweites Argument nimmt es den juengsten Job mit Schritt ingest_rag.
 * Eine UUID (8-4-4-4-12) gilt als jobId, alles andere als sourceId.
 * Mit WELLE_K_DB=<name> eine andere Datenbank als die Prod-DB.
 */
import { MongoClient } from 'mongodb'
import { readFileSync } from 'node:fs'

function envAusDatei() {
  const env = { ...process.env }
  try {
    for (const zeile of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
      const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
    }
  } catch {
    // keine .env — dann muessen die Variablen gesetzt sein
  }
  return env
}

const env = envAusDatei()
const [libraryId, zweites] = process.argv.slice(2)
const istJobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zweites ?? '')
const jobIdArg = istJobId ? zweites : undefined
const sourceIdArg = istJobId ? undefined : zweites
if (!libraryId) {
  console.error('Aufruf: node scripts/welle-k-ist-zustand-lesen.mjs <libraryId> [sourceId | jobId]')
  process.exit(2)
}
const uri = env.MONGODB_URI
const dbName = env.WELLE_K_DB ?? env.MONGODB_DATABASE_NAME_PROD
if (!uri || !dbName) {
  console.error('MONGODB_URI und MONGODB_DATABASE_NAME_PROD (oder WELLE_K_DB) muessen gesetzt sein — kein Default')
  process.exit(2)
}

const EREIGNISSE = new Set([
  'slide_images_resolved', 'slide_images_unresolved', 'cover_source', 'attachments_source',
  'attachments_links_rewritten', 'extract_only_page_images_registered', 'extract_only_page_images_skipped',
  'extract_only_page_images_error', 'frontmatter_json_list_invalid',
])

const client = new MongoClient(uri, { readPreference: 'secondaryPreferred' })
try {
  await client.connect()
  const db = client.db(dbName)
  const jobs = db.collection('external_jobs')
  const filter = jobIdArg
    ? { libraryId, jobId: jobIdArg }
    : { libraryId, 'steps.name': 'ingest_rag', ...(sourceIdArg ? { 'correlation.source.itemId': sourceIdArg } : {}) }
  const job = await jobs.find(filter).sort({ createdAt: -1 }).limit(1).next()
  if (!job) {
    console.log(JSON.stringify({ datenbank: dbName, libraryId, hinweis: 'kein Job mit ingest_rag fuer diese Library/Quelle' }, null, 2))
  } else {
    const events = Array.isArray(job.trace?.events) ? job.trace.events : []
    const sourceId = job.correlation?.source?.itemId ?? sourceIdArg ?? null
    const meta = sourceId ? await db.collection(`doc_meta__${libraryId}`).findOne({ _id: `${sourceId}-meta`, kind: 'meta' }) : null
    const m = meta?.docMetaJson ?? {}
    console.log(JSON.stringify({
      datenbank: dbName,
      job: {
        jobId: job.jobId, status: job.status, jobTyp: job.job_type, erstellt: job.createdAt,
        quelle: job.correlation?.source ?? null, options: job.correlation?.options ?? null,
        schritte: (job.steps ?? []).map((s) => ({ name: s.name, status: s.status, details: s.details ?? null })),
        ereignisseLesersicht: events.filter((e) => EREIGNISSE.has(e.name)).map((e) => ({ ts: e.ts, spanId: e.spanId, name: e.name, attributes: e.attributes ?? null })),
        alleEreignisNamen: [...new Set(events.map((e) => e.name))],
        logPhasen: [...new Set((job.logs ?? []).map((l) => l.phase).filter(Boolean))],
      },
      metaDokument: meta ? {
        _id: meta._id, fileId: meta.fileId, fileName: meta.fileName, title: meta.title, slug: meta.slug,
        detailViewType: meta.detailViewType ?? m.detailViewType ?? null, upsertedAt: meta.upsertedAt, publication: meta.publication ?? null,
        topLevelFelder: Object.keys(meta),
        docMetaJsonFelder: Object.keys(m),
        coverImageUrl: m.coverImageUrl ?? null, coverThumbnailUrl: m.coverThumbnailUrl ?? null,
        attachments_url: m.attachments_url ?? null, attachments_names: m.attachments_names ?? null,
        slidesTyp: Array.isArray(m.slides) ? `array(${m.slides.length})` : typeof m.slides,
        slidesErste: Array.isArray(m.slides) ? m.slides.slice(0, 2) : (typeof m.slides === 'string' ? m.slides.slice(0, 200) : null),
        galleryImageUrlsTyp: Array.isArray(m.galleryImageUrls) ? `array(${m.galleryImageUrls.length})` : typeof m.galleryImageUrls,
      } : { hinweis: `kein Meta-Dokument ${sourceId}-meta in doc_meta__${libraryId}` },
    }, null, 2))
  }
} finally {
  await client.close()
}
