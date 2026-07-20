/**
 * Migration: Website-Docs von Mongo-only-Seeds zu echten Dateien (Konvention).
 *
 * Die 4 Website-Docs (Home/Impressum/Kontakt/Footer) wurden per Seed direkt
 * in `doc_meta` geschrieben — ohne Quelldatei im Storage. Damit fehlte der
 * regulaere Pflege-Weg (Archiv-Frontmatter-Editor, Re-Publish, Re-Translate).
 *
 * Diese Migration stellt die Konvention her, PRO Seite:
 *  1. Inhalt aus dem geseedeten Meta-Doc lesen (Live-Stand = Quelle).
 *  2. Markdown-Datei (flaches Frontmatter + Body) nach Nextcloud hochladen
 *     (Ordner `Webseite/Seiten`).
 *  3. Shadow-Twin-Transformation registrieren (ShadowTwinService, Mongo-Mode)
 *     — Voraussetzung fuer den regulaeren `ingest-markdown`-Re-Publish.
 *  4. Regulaer ingestieren (IngestionService.upsertMarkdown) -> neues doc_meta.
 *  5. Das alte geseedete Meta-Doc loeschen.
 *
 * Read-only-Vorschau:  node --import tsx scripts/migrate-website-docs-to-files.ts
 * Ausfuehren:          node --import tsx scripts/migrate-website-docs-to-files.ts --apply
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { MongoClient } from 'mongodb'
import { getServerProvider } from '../src/lib/storage/server-provider'
import { LibraryService } from '../src/lib/services/library-service'
import { ShadowTwinService } from '../src/lib/shadow-twin/store/shadow-twin-service'
import { IngestionService } from '../src/lib/chat/ingestion-service'
import { createMarkdownWithFrontmatter } from '../src/lib/markdown/compose'

const USER = 'peter.aichner@crystal-design.com'
const LIB = '5a28b4bd-c498-41f9-8d63-e93a0d05d7ca'
const COLLECTION = `doc_meta__${LIB}`
const FOLDER_PARENT = 'Webseite'
const FOLDER_NAME = 'Seiten'
/** Deterministischer Template-Name des Transformations-Artefakts (Pflichtfeld). */
const TEMPLATE_NAME = 'website-page'
const APPLY = process.argv.includes('--apply')

/** Seed-fileIds -> Ziel-Dateinamen (Live-Stand aus Mongo wird uebernommen). */
const SEEDED: Array<{ fileId: string; fileName: string }> = [
  { fileId: 'website-oldies-home', fileName: 'Oldies for Future.md' },
  { fileId: 'website-oldies-impressum', fileName: 'Impressum.md' },
  { fileId: 'website-oldies-kontakt', fileName: 'Kontakt.md' },
  { fileId: 'website-oldies-footer', fileName: 'Footer.md' },
]

/** Nicht ins Frontmatter uebernehmen: Body + pipeline-verwaltete Felder. */
const EXCLUDED_KEYS = new Set(['markdown', 'publication', 'translationStatus', 'translations'])

async function main(): Promise<void> {
  const mongo = new MongoClient(process.env.MONGODB_URI as string)
  await mongo.connect()
  const col = mongo.db(process.env.MONGODB_DATABASE_NAME as string).collection(COLLECTION)

  const provider = await getServerProvider(USER, LIB)
  const library = await LibraryService.getInstance().getLibrary(USER, LIB)
  if (!library) throw new Error('Library nicht gefunden')

  // Zielordner `Webseite/Seiten` finden/anlegen.
  const root = await provider.listItemsById('root')
  const webFolder = root.find((i) => i.type === 'folder' && i.metadata.name === FOLDER_PARENT)
  if (!webFolder) throw new Error(`Ordner "${FOLDER_PARENT}" nicht gefunden`)
  const webItems = await provider.listItemsById(webFolder.id)
  let seiten = webItems.find((i) => i.type === 'folder' && i.metadata.name === FOLDER_NAME)
  if (!seiten) {
    if (!APPLY) {
      console.log(`WUERDE ANLEGEN: Ordner ${FOLDER_PARENT}/${FOLDER_NAME}`)
    } else {
      seiten = await provider.createFolder(webFolder.id, FOLDER_NAME)
      console.log(`Ordner angelegt: ${FOLDER_PARENT}/${FOLDER_NAME}`)
    }
  }

  for (const { fileId, fileName } of SEEDED) {
    const seedDoc = await col.findOne({ _id: `${fileId}-meta` as never })
    if (!seedDoc) {
      console.warn(`UEBERSPRUNGEN (Seed-Doc fehlt): ${fileId}`)
      continue
    }
    const json = (seedDoc.docMetaJson ?? {}) as Record<string, unknown>
    const body = typeof json.markdown === 'string' ? json.markdown : ''
    if (!body.trim()) throw new Error(`Seed-Doc ${fileId} hat keinen markdown-Body`)

    const frontmatter: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(json)) {
      if (!EXCLUDED_KEYS.has(k) && v !== undefined && v !== null) frontmatter[k] = v
    }
    // Einziger Frontmatter-Serializer (frontmatter-single-serializer.mdc).
    const markdown = createMarkdownWithFrontmatter(body, frontmatter)

    if (!APPLY) {
      console.log(`WUERDE MIGRIEREN: ${fileName} (${markdown.length} Zeichen, ${Object.keys(frontmatter).length} Frontmatter-Felder)`)
      continue
    }
    if (!seiten) throw new Error('Zielordner fehlt (Dry-Run-Zweig?)')

    // 2) Quelldatei hochladen (idempotent: Nextcloud ueberschreibt bei gleichem Namen).
    const file = new File([markdown], fileName, { type: 'text/markdown' })
    const item = await provider.uploadFile(seiten.id, file)
    console.log(`Datei hochgeladen: ${FOLDER_PARENT}/${FOLDER_NAME}/${fileName} (id=${item.id.slice(0, 24)}…)`)

    // 3) Shadow-Twin-Transformation (Mongo-Mode: Voraussetzung fuer Re-Publish).
    const twinService = new ShadowTwinService({
      library,
      userEmail: USER,
      sourceId: item.id,
      sourceName: fileName,
      parentId: seiten.id,
      provider,
    })
    await twinService.upsertMarkdown({
      kind: 'transformation',
      targetLanguage: 'de',
      templateName: TEMPLATE_NAME,
      markdown,
    })
    console.log(`  Shadow-Twin-Transformation registriert (${TEMPLATE_NAME}/de)`)

    // 4) Regulaerer Ingest -> neues doc_meta (fileId = Storage-Item-ID).
    const res = await IngestionService.upsertMarkdown(USER, LIB, item.id, fileName, markdown, undefined, undefined, provider)
    console.log(`  Ingest ok (chunks=${res.chunksUpserted})`)

    // 5) Altes Seed-Doc abloesen.
    const del = await col.deleteOne({ _id: `${fileId}-meta` as never })
    console.log(`  Seed-Doc geloescht: ${fileId} (deleted=${del.deletedCount})`)
  }

  await mongo.close()
  if (!APPLY) console.log('\nTrockenlauf — zum Ausfuehren mit --apply aufrufen.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate-website-docs] FEHLER:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
