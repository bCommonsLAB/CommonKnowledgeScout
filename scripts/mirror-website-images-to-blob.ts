/**
 * Spiegelt die kuratierten Website-Bilder der Oldies-Library aus dem (auth-gegateten)
 * Nextcloud-Ordner `web/images/` in den OEFFENTLICH lesbaren Azure-Blob-Container.
 * Danach sind die Bilder ueber direkte Blob-URLs auch ANONYM ladbar — genau wie die
 * echten Galerie-Karten (die ebenfalls auf `ragtempproject.blob.core.windows.net`
 * zeigen).
 *
 * Read (Nextcloud) + Write (Blob). Idempotent: Ueberschreibt vorhandene Blobs.
 *
 * Aufruf:  node --import tsx scripts/mirror-website-images-to-blob.ts
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { BlobServiceClient } from '@azure/storage-blob'
import { getServerProvider } from '../src/lib/storage/server-provider'

const USER = 'peter.aichner@crystal-design.com'
const LIB = '5a28b4bd-c498-41f9-8d63-e93a0d05d7ca'
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER_NAME || 'knowledgescout'
// Ziel-Prefix im Blob (bewusst getrennt von der Ingest-Pipeline `books/`).
const BLOB_PREFIX = `${LIB}/website/images`

// Genau die Dateien, die die Seed-Docs referenzieren.
const FILES = [
  'oldies-for-future-headimage-2_web.jpg',
  'IMG-20230419-WA0003.jpg',
  'oldies-for-future-warum_web.jpg',
  'oldies-for-future-loesung-2K_web.webp',
  'oldies-for-future-gemeinsamaktiv_web.jpg',
]

function contentTypeFor(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'svg') return 'image/svg+xml'
  throw new Error(`Unbekannter Bild-Typ fuer "${name}"`)
}

async function main(): Promise<void> {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING fehlt')

  const provider = await getServerProvider(USER, LIB)

  // web/images-Ordner-ID ueber Namens-Traversal ermitteln.
  const root = await provider.listItemsById('root')
  const webFolder = root.find((i) => i.type === 'folder' && i.metadata.name.toLowerCase() === 'web')
  if (!webFolder) throw new Error('Ordner "web" nicht gefunden')
  const webItems = await provider.listItemsById(webFolder.id)
  const imagesFolder = webItems.find((i) => i.type === 'folder' && i.metadata.name.toLowerCase() === 'images')
  if (!imagesFolder) throw new Error('Ordner "web/images" nicht gefunden')
  const imageItems = await provider.listItemsById(imagesFolder.id)

  const svc = BlobServiceClient.fromConnectionString(conn)
  const container = svc.getContainerClient(CONTAINER)
  const account = svc.accountName

  for (const fileName of FILES) {
    const item = imageItems.find((i) => i.type === 'file' && i.metadata.name === fileName)
    if (!item) { console.error(`  FEHLT im Nextcloud: ${fileName}`); continue }

    const { blob } = await provider.getBinary(item.id)
    const buffer = Buffer.from(await blob.arrayBuffer())
    const blobPath = `${BLOB_PREFIX}/${fileName}`
    const blockBlob = container.getBlockBlobClient(blobPath)
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentTypeFor(fileName) },
    })
    const url = `https://${account}.blob.core.windows.net/${CONTAINER}/${blobPath}`
    console.log(`  hochgeladen (${buffer.length} B): ${url}`)
  }

  console.log(`\nBlob-Basis-URL fuer Seed:`)
  console.log(`https://${account}.blob.core.windows.net/${CONTAINER}/${BLOB_PREFIX}`)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('[mirror] Fehler:', e instanceof Error ? e.message : e)
  process.exit(1)
})
